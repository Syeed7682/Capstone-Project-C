import os
import json
import time
import hashlib
import uuid
from typing import Optional, List, Dict, Any
from pathlib import Path

from app import config

# Optional PyMongo import
try:
    import pymongo
    HAS_PYMONGO = True
except ImportError:
    HAS_PYMONGO = False

# Local fallback file path
LOCAL_DB_FILE = config.DATA_DIR / "db_local.json"

class MongoDBManager:
    def __init__(self):
        self.client = None
        self.db = None
        self.connected = False
        self.init_db()

    def init_db(self):
        """Initialize MongoDB client if URI or API Key is available."""
        uri = config.MONGODB_URI or os.getenv("MONGODB_URI", "")
        if HAS_PYMONGO and uri:
            try:
                self.client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=3000)
                self.db = self.client[config.MONGODB_DB_NAME]
                # Ping database
                self.client.admin.command('ping')
                self.connected = True
                print(f"[MongoDB] Connected to MongoDB Atlas cluster database '{config.MONGODB_DB_NAME}'")
            except Exception as e:
                print(f"[MongoDB] PyMongo connection notice: {e}. Operating in resilient local storage mode.")
                self.connected = False
        else:
            if config.MONGODB_API_KEY:
                print(f"[MongoDB] Atlas API Key loaded ({config.MONGODB_API_KEY[:8]}...). Storage engine active.")
            else:
                print("[MongoDB] Local persistence active.")

    # ── Local File Helper ──────────────────────────────────────────────────
    def _read_local_store(self) -> Dict[str, List[Dict[str, Any]]]:
        if not LOCAL_DB_FILE.exists():
            return {"users": [], "sessions": [], "messages": [], "reports": [], "metadata": []}
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for k in ["users", "sessions", "messages", "reports", "metadata"]:
                    if k not in data:
                        data[k] = []
                return data
        except Exception:
            return {"users": [], "sessions": [], "messages": [], "reports": [], "metadata": []}

    def _write_local_store(self, data: Dict[str, List[Dict[str, Any]]]):
        try:
            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving local DB file: {e}")

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode('utf-8')).hexdigest()

    # ── 1. USERS COLLECTION (Auth) ──────────────────────────────────────────
    def register_user(self, first_name: str, last_name: str, email: str, password: str) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        password_hash = self._hash_password(password)
        now = time.time()
        
        user_doc = {
            "id": str(uuid.uuid4()),
            "firstName": first_name.strip(),
            "lastName": last_name.strip(),
            "email": email_clean,
            "password_hash": password_hash,
            "createdAt": now
        }

        # Try MongoDB Atlas insertion
        if self.connected and self.db is not None:
            try:
                # Check exists
                if self.db.users.find_one({"email": email_clean}):
                    raise ValueError("This email is already registered.")
                self.db.users.insert_one(user_doc.copy())
            except ValueError:
                raise
            except Exception as e:
                print(f"[MongoDB] Fallback on insert_user: {e}")

        # Sync local store
        store = self._read_local_store()
        if any(u["email"] == email_clean for u in store["users"]):
            raise ValueError("This email is already registered.")
        store["users"].append(user_doc)
        self._write_local_store(store)

        safe_user = user_doc.copy()
        safe_user.pop("password_hash", None)
        return safe_user

    def authenticate_user(self, email: str, password: str) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        password_hash = self._hash_password(password)

        if self.connected and self.db is not None:
            try:
                user = self.db.users.find_one({"email": email_clean, "password_hash": password_hash})
                if user:
                    user["_id"] = str(user.get("_id", user.get("id")))
                    user.pop("password_hash", None)
                    return user
            except Exception as e:
                print(f"[MongoDB] Auth query fallback: {e}")

        # Local check
        store = self._read_local_store()
        for u in store["users"]:
            if u["email"] == email_clean and u["password_hash"] == password_hash:
                safe = u.copy()
                safe.pop("password_hash", None)
                return safe

        raise ValueError("Invalid email or password.")

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        email_clean = email.strip().lower()
        if self.connected and self.db is not None:
            try:
                u = self.db.users.find_one({"email": email_clean}, {"password_hash": 0})
                if u:
                    u["_id"] = str(u.get("_id", u.get("id")))
                    return u
            except Exception:
                pass
        store = self._read_local_store()
        for u in store["users"]:
            if u["email"] == email_clean:
                safe = u.copy()
                safe.pop("password_hash", None)
                return safe
        return None

    def update_user(self, current_email: str, first_name: str, last_name: str, new_email: str, new_password: Optional[str] = None, avatar_color: Optional[str] = None, profile_image: Optional[str] = None) -> Dict[str, Any]:
        current_email_clean = current_email.strip().lower()
        new_email_clean = new_email.strip().lower()
        
        # Check if email is changing and if the new email already exists
        if current_email_clean != new_email_clean:
            existing = self.get_user_by_email(new_email_clean)
            if existing:
                raise ValueError("The new email is already registered by another user.")
        
        now = time.time()
        
        # Find user doc in local database to get ID
        store = self._read_local_store()
        user_idx = -1
        for idx, u in enumerate(store["users"]):
            if u["email"] == current_email_clean:
                user_idx = idx
                break
        
        if user_idx == -1:
            raise ValueError("User profile not found.")
            
        user_doc = store["users"][user_idx]
        user_doc["firstName"] = first_name.strip()
        user_doc["lastName"] = last_name.strip()
        user_doc["email"] = new_email_clean
        if avatar_color:
            user_doc["avatarColor"] = avatar_color.strip()
        if profile_image is not None:
            user_doc["profileImage"] = profile_image
        
        if new_password and new_password.strip():
            user_doc["password_hash"] = self._hash_password(new_password)
            
        # MongoDB Atlas update
        if self.connected and self.db is not None:
            try:
                update_fields = {
                    "firstName": user_doc["firstName"],
                    "lastName": user_doc["lastName"],
                    "email": user_doc["email"],
                }
                if new_password and new_password.strip():
                    update_fields["password_hash"] = user_doc["password_hash"]
                if avatar_color:
                    update_fields["avatarColor"] = user_doc["avatarColor"]
                if profile_image is not None:
                    update_fields["profileImage"] = profile_image
                
                self.db.users.update_one(
                    {"email": current_email_clean},
                    {"$set": update_fields}
                )
                
                # If email is changing, we should also update related records in other collections
                if current_email_clean != new_email_clean:
                    self.db.sessions.update_many({"user_email": current_email_clean}, {"$set": {"user_email": new_email_clean}})
                    self.db.messages.update_many({"user_email": current_email_clean}, {"$set": {"user_email": new_email_clean}})
                    self.db.reports.update_many({"user_email": current_email_clean}, {"$set": {"user_email": new_email_clean}})
                    self.db.metadata.update_many({"user_email": current_email_clean}, {"$set": {"user_email": new_email_clean}})
            except Exception as e:
                print(f"[MongoDB] Atlas update_user error: {e}")
                
        # Update related records in local store
        if current_email_clean != new_email_clean:
            for s in store["sessions"]:
                if s.get("user_email") == current_email_clean:
                    s["user_email"] = new_email_clean
            for m in store["messages"]:
                if m.get("user_email") == current_email_clean:
                    m["user_email"] = new_email_clean
            for r in store["reports"]:
                if r.get("user_email") == current_email_clean:
                    r["user_email"] = new_email_clean
            for me in store["metadata"]:
                if me.get("user_email") == current_email_clean:
                    me["user_email"] = new_email_clean
                    
        # Update user list
        store["users"][user_idx] = user_doc
        self._write_local_store(store)
        
        safe_user = user_doc.copy()
        safe_user.pop("password_hash", None)
        return safe_user

    # ── 2. SESSIONS & MESSAGES COLLECTIONS ──────────────────────────────────
    def save_message(self, session_id: str, role: str, text: str, user_email: Optional[str] = None, 
                     engine: Optional[str] = None, retrieved: Optional[List[Dict[str, Any]]] = None,
                     image_url: Optional[str] = None) -> Dict[str, Any]:
        now = time.time()
        msg_doc = {
            "id": f"{role}-{int(now * 1000)}-{uuid.uuid4().hex[:4]}",
            "session_id": session_id,
            "user_email": user_email.lower() if user_email else "anonymous",
            "role": role,
            "text": text,
            "imageUrl": image_url,
            "engine": engine,
            "retrieved": retrieved or [],
            "timestamp": int(now * 1000)
        }

        # MongoDB Mongo insert
        if self.connected and self.db is not None:
            try:
                self.db.messages.insert_one(msg_doc.copy())
                # Upsert session doc
                self.db.sessions.update_one(
                    {"session_id": session_id},
                    {
                        "$set": {
                            "updatedAt": now,
                            "user_email": user_email.lower() if user_email else "anonymous",
                        },
                        "$setOnInsert": {
                            "session_id": session_id,
                            "title": text[:40] if role == "user" else "Clinical Consultation",
                            "createdAt": now
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                print(f"[MongoDB] Message save notice: {e}")

        # Sync local store
        store = self._read_local_store()
        store["messages"].append(msg_doc)
        
        # Upsert local session
        sess_idx = next((i for i, s in enumerate(store["sessions"]) if s["session_id"] == session_id), -1)
        if sess_idx >= 0:
            store["sessions"][sess_idx]["updatedAt"] = now
            if user_email:
                store["sessions"][sess_idx]["user_email"] = user_email.lower()
        else:
            store["sessions"].append({
                "session_id": session_id,
                "title": text[:40] if role == "user" else "Clinical Consultation",
                "user_email": user_email.lower() if user_email else "anonymous",
                "createdAt": now,
                "updatedAt": now
            })
        self._write_local_store(store)
        return msg_doc

    def get_user_sessions(self, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        target_email = user_email.lower() if user_email else None
        results = []

        if self.connected and self.db is not None:
            try:
                query = {"user_email": target_email} if target_email else {}
                cursor = self.db.sessions.find(query).sort("updatedAt", pymongo.DESCENDING)
                for doc in cursor:
                    doc["_id"] = str(doc.get("_id"))
                    results.append(doc)
                if results:
                    return results
            except Exception as e:
                print(f"[MongoDB] Sessions fetch error: {e}")

        # Local fallback
        store = self._read_local_store()
        sessions = store["sessions"]
        if target_email:
            sessions = [s for s in sessions if s.get("user_email") == target_email or s.get("user_email") == "anonymous"]
        sessions.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
        return sessions

    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        results = []
        if self.connected and self.db is not None:
            try:
                cursor = self.db.messages.find({"session_id": session_id}).sort("timestamp", pymongo.ASCENDING)
                for doc in cursor:
                    doc["_id"] = str(doc.get("_id"))
                    results.append(doc)
                if results:
                    return results
            except Exception:
                pass

        # Local fallback
        store = self._read_local_store()
        msgs = [m for m in store["messages"] if m.get("session_id") == session_id]
        msgs.sort(key=lambda x: x.get("timestamp", 0))
        return msgs

    def delete_session(self, session_id: str):
        if self.connected and self.db is not None:
            try:
                self.db.sessions.delete_one({"session_id": session_id})
                self.db.messages.delete_many({"session_id": session_id})
                self.db.reports.delete_many({"session_id": session_id})
            except Exception:
                pass

        store = self._read_local_store()
        store["sessions"] = [s for s in store["sessions"] if s.get("session_id") != session_id]
        store["messages"] = [m for m in store["messages"] if m.get("session_id") != session_id]
        store["reports"] = [r for r in store["reports"] if r.get("session_id") != session_id]
        self._write_local_store(store)

    # ── 3. REPORTS COLLECTION ───────────────────────────────────────────────
    def save_report(self, session_id: str, title: str, summary: str, findings: str, 
                    user_email: Optional[str] = None, retrieved_cases: Optional[List[Dict[str, Any]]] = None,
                    image_url: Optional[str] = None) -> Dict[str, Any]:
        now = time.time()
        report_doc = {
            "report_id": f"rep-{uuid.uuid4().hex[:8]}",
            "session_id": session_id,
            "user_email": user_email.lower() if user_email else "anonymous",
            "title": title,
            "summary": summary,
            "findings": findings,
            "image_url": image_url,
            "retrieved_cases": retrieved_cases or [],
            "createdAt": now
        }

        if self.connected and self.db is not None:
            try:
                self.db.reports.insert_one(report_doc.copy())
            except Exception as e:
                print(f"[MongoDB] Report insert error: {e}")

        store = self._read_local_store()
        store["reports"].append(report_doc)
        self._write_local_store(store)
        return report_doc

    def get_reports(self, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        target_email = user_email.lower() if user_email else None
        if self.connected and self.db is not None:
            try:
                query = {"user_email": target_email} if target_email else {}
                cursor = self.db.reports.find(query).sort("createdAt", pymongo.DESCENDING)
                reports = []
                for r in cursor:
                    r["_id"] = str(r.get("_id"))
                    reports.append(r)
                if reports:
                    return reports
            except Exception:
                pass

        store = self._read_local_store()
        reps = store["reports"]
        if target_email:
            reps = [r for r in reps if r.get("user_email") == target_email or r.get("user_email") == "anonymous"]
        reps.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
        return reps

    def delete_report(self, report_id: str) -> bool:
        if self.connected and self.db is not None:
            try:
                self.db.reports.delete_one({"report_id": report_id})
            except Exception as e:
                print(f"[MongoDB] Report delete error: {e}")

        store = self._read_local_store()
        original_count = len(store["reports"])
        store["reports"] = [r for r in store["reports"] if r.get("report_id") != report_id]
        self._write_local_store(store)
        return len(store["reports"]) < original_count

    # ── 4. METADATA COLLECTION ──────────────────────────────────────────────
    def log_metadata(self, event_type: str, details: Dict[str, Any], user_email: Optional[str] = None):
        meta_doc = {
            "id": f"meta-{uuid.uuid4().hex[:8]}",
            "event_type": event_type,
            "user_email": user_email.lower() if user_email else "anonymous",
            "details": details,
            "timestamp": time.time()
        }

        if self.connected and self.db is not None:
            try:
                self.db.metadata.insert_one(meta_doc.copy())
            except Exception:
                pass

        store = self._read_local_store()
        store["metadata"].append(meta_doc)
        # Keep last 200 metadata entries in local storage
        if len(store["metadata"]) > 200:
            store["metadata"] = store["metadata"][-200:]
        self._write_local_store(store)

    def get_system_metadata(self) -> Dict[str, Any]:
        store = self._read_local_store()
        return {
            "total_users": len(store["users"]),
            "total_sessions": len(store["sessions"]),
            "total_messages": len(store["messages"]),
            "total_reports": len(store["reports"]),
            "mongo_connected": self.connected,
            "database_name": config.MONGODB_DB_NAME,
            "has_api_key": bool(config.MONGODB_API_KEY),
        }

# Global singleton instance
db_manager = MongoDBManager()
