# MedRAG-AI: Comprehensive System Diagrams

This document contains all essential and recommended architectural diagrams for the **MedRAG-AI** (Medical Image VQA RAG) platform.

---

## Part 1: Essential Diagrams ⭐

### 1. System Architecture
This high-level architecture diagram illustrates the logical separation of concerns across the Presentation, Application, AI/ML, and Data layers.

```mermaid
flowchart TD
    subgraph Presentation Layer
        UI["React + Vite UI"]
        Dashboard["Chat Dashboard"]
        Profile["Profile & Settings"]
        RAGInspector["RAG Context Inspector"]
    end

    subgraph Application Layer
        API["FastAPI Backend"]
        AuthManager["Authentication Manager"]
        SessionManager["Session & Report Manager"]
        QueryRouter["Query Router"]
    end

    subgraph AI & ML Layer
        Pipeline["RAG Pipeline Engine"]
        Encoder["BiomedCLIP Encoder"]
        Generators["Multi-LLM Generators"]
    end

    subgraph Data & Storage Layer
        Mongo[("MongoDB Atlas\n(Users, Chats, Reports)")]
        VectorDB[("Pinecone / FAISS\n(SLAKE Embeddings)")]
    end

    Presentation Layer <-->|HTTP/REST| Application Layer
    Application Layer <--> Data & Storage Layer
    Application Layer <--> AI & ML Layer
    AI & ML Layer <--> VectorDB
```

---

### 2. System Context
A C4 Context diagram showing the MedRAG-AI system in its environment, interacting with users and external cloud services.

```mermaid
flowchart TD
    User(("Clinician / User"))
    MedRAG["MedRAG-AI System"]
    
    Mongo["MongoDB Atlas"]
    Pinecone["Pinecone Cloud"]
    HuggingFace["Hugging Face API"]
    Gemini["Google Gemini API"]
    
    User -->|Asks medical questions,\nuploads radiology images| MedRAG
    MedRAG -->|Authenticates, stores logs| Mongo
    MedRAG -->|Queries nearest neighbors| Pinecone
    MedRAG -->|Inferences VQA models| HuggingFace
    MedRAG -->|Inferences VQA models| Gemini
```

---

### 3. Use Case Diagram
Maps out the primary interactions the user has with the platform.

```mermaid
flowchart LR
    User((Clinician))
    
    subgraph MedRAG-AI Platform
        Auth["Authenticate (Login/Signup)"]
        Profile["Manage Profile (Name, Avatar)"]
        Query["Submit VQA Query (Text + Image)"]
        Context["View RAG Explainability (Context)"]
        Report["Generate Clinical PDF Report"]
        Config["Hot-Swap LLM Engine & Parameters"]
    end
    
    User --> Auth
    User --> Profile
    User --> Query
    User --> Context
    User --> Report
    User --> Config
```

---

### 4. DFD Level 0 (Context Diagram)
A high-level Data Flow Diagram showing the primary data inputs and outputs of the entire system.

```mermaid
flowchart LR
    Clinician["Clinician"]
    System(("MedRAG-AI\nSystem"))
    DB["Cloud Databases\n(MongoDB, Pinecone)"]
    LLM["External AI APIs"]

    Clinician -->|1. Credentials, Image, Query| System
    System -->|2. Answer, RAG Context, Report| Clinician
    
    System -->|3. Save State, Query Vectors| DB
    DB -->|4. User Profile, Top-K Neighbors| System
    
    System -->|5. Grounded Prompt + Image| LLM
    LLM -->|6. Generated Medical Answer| System
```

---

### 5. DFD Level 1
Breaks down the system into distinct sub-processes and data stores.

```mermaid
flowchart TD
    User["Clinician"]
    
    P1(("1.0\nAuth\nManagement"))
    P2(("2.0\nSession\nManagement"))
    P3(("3.0\nRAG\nRetrieval"))
    P4(("4.0\nAI\nGeneration"))
    P5(("5.0\nReport\nGeneration"))
    
    D1[("D1: MongoDB (Users)")]
    D2[("D2: MongoDB (Sessions/Chats)")]
    D3[("D3: Vector DB (SLAKE)")]
    
    User -->|Credentials| P1
    P1 <-->|Verify/Create| D1
    P1 -->|Auth Token| User
    
    User -->|Create Chat| P2
    P2 <-->|Store History| D2
    
    User -->|Question + Image| P3
    P3 -->|Vector Search| D3
    D3 -->|Historical Contexts| P3
    
    P3 -->|Context + Query| P4
    P4 -->|Prompt| ExternalLLM["External LLM"]
    ExternalLLM -->|Answer| P4
    P4 -->|Final Response| User
    P4 -->|Log Message| P2
    
    User -->|Request Export| P5
    D2 -->|Session History| P5
    P5 -->|Clinical Report (PDF/MD)| User
```

---

### 6. System Workflow (Activity Diagram)
The end-to-end activity flow for processing a single clinical query.

```mermaid
flowchart TD
    A([User submits question + image]) --> B{Is user authenticated?}
    B -- No --> Reject([Return 401 Unauthorized])
    B -- Yes --> C[Load session history]
    C --> D[Cache uploaded image]
    
    D --> E["pipeline.retrieve()"] 
    E --> F[BiomedCLIP encode text/image]
    F --> G[Query Pinecone / FAISS]
    G --> H[Retrieve Top-K SLAKE contexts]
    
    H --> I[Build grounded medical prompt]
    I --> J[Run configured LLM engine]
    J --> K[Answer generated]
    
    K --> L[Save messages to MongoDB Atlas]
    L --> M([Frontend renders answer & RAG inspector])
```

---

### 7. Sequence Diagram
The sequential interactions across system boundaries during a VQA request.

```mermaid
sequenceDiagram
    participant U as Clinician
    participant UI as Frontend React
    participant API as FastAPI Backend
    participant RAG as Retrieval Pipeline
    participant VDB as Pinecone DB
    participant LLM as LLM Engine
    participant DB as MongoDB Atlas

    U->>UI: Uploads X-ray & asks question
    UI->>API: POST /api/query (Auth Header)
    API->>RAG: retrieve(image, text)
    RAG->>VDB: search(fused_vector, top_k)
    VDB-->>RAG: top-K similar SLAKE cases
    RAG->>LLM: generate_answer(prompt, image)
    LLM-->>RAG: medical answer text
    RAG-->>API: answer + retrieved contexts
    API->>DB: save_message(user_query)
    API->>DB: save_message(ai_answer)
    API-->>UI: JSON response
    UI-->>U: Displays answer and contexts
```

---

### 8. RAG Pipeline Architecture
Detailed view of the Retrieval-Augmented Generation math and flow.

```mermaid
flowchart LR
    subgraph Input
        Img["Medical Image"]
        Text["Clinical Question"]
    end
    
    subgraph Embedding Layer (BiomedCLIP)
        ViT["ViT-B/16 Image Encoder"]
        BERT["PubMedBERT Text Encoder"]
        Blend["α-Blending (Fusion)"]
        L2["L2 Normalization"]
    end
    
    subgraph Retrieval
        Index[("Vector Index\n(FAISS/Pinecone)")]
        TopK["Top-K Matching\n(Cosine Similarity)"]
    end
    
    subgraph Generation
        Prompt["Grounded Prompt Builder\n(System + Contexts + Query)"]
        VLM["Vision-Language Model"]
    end
    
    Img --> ViT
    Text --> BERT
    ViT --> Blend
    BERT --> Blend
    Blend --> L2
    L2 --> Index
    Index --> TopK
    TopK --> Prompt
    Prompt --> VLM
```

---

## Part 2: Recommended Diagrams

### 9. Component Diagram
Shows how the logical software components are structured within the codebase.

```mermaid
flowchart TB
    subgraph Frontend (React/Vite)
        App["App.tsx (State)"]
        Components["Components (Chat, Sidebar, Modals)"]
        CSS["index.css (Tailwind)"]
        App --> Components
        Components --> CSS
    end

    subgraph Backend (FastAPI)
        Main["main.py (Routes)"]
        Config["config.py (Env)"]
        DBManager["db.py (MongoDB)"]
        Pipe["pipeline.py (RAG & Models)"]
        
        Main --> Config
        Main --> DBManager
        Main --> Pipe
        Pipe --> Config
    end
    
    Frontend <-->|REST API| Backend
```

---

### 10. Deployment Diagram
Illustrates the physical nodes and networking topology.

```mermaid
flowchart TD
    node1["Client Node\n(Browser / Mobile)"]
    
    subgraph Application Server (Local / EC2)
        node2["Uvicorn ASGI Server\n(FastAPI Runtime)"]
        node3["Local Disk\n(Images, Caches)"]
    end
    
    subgraph Cloud Infrastructure
        node4[("MongoDB Atlas Node\n(Replica Set)")]
        node5[("Pinecone DB Node\n(Serverless)")]
        node6["Hugging Face / Gemini API\n(GPU Clusters)"]
    end
    
    node1 <-->|HTTPS :8000| node2
    node2 <-->|I/O| node3
    node2 <-->|TCP / TLS| node4
    node2 <-->|HTTPS / gRPC| node5
    node2 <-->|HTTPS| node6
```

---

### 11. ER/Database Schema (MongoDB)
Maps out the data collections and relationships for the persistence layer.

```mermaid
erDiagram
    USERS {
        ObjectId _id PK
        string email UK
        string firstName
        string lastName
        string password_hash
        string avatarColor
        string profileImage "Base64 encoded"
    }
    
    SESSIONS {
        ObjectId _id PK
        string session_id UK
        string user_email FK
        string title
        float timestamp
    }
    
    MESSAGES {
        ObjectId _id PK
        string message_id UK
        string session_id FK
        string user_email FK
        string role "user or assistant"
        string text
        string engine "LLM used"
        array retrieved "Contexts"
        float timestamp
    }
    
    REPORTS {
        ObjectId _id PK
        string report_id UK
        string session_id FK
        string user_email FK
        string title
        string markdown_content
        float created_at
    }

    USERS ||--o{ SESSIONS : "owns"
    SESSIONS ||--o{ MESSAGES : "contains"
    USERS ||--o{ MESSAGES : "owns"
    USERS ||--o{ REPORTS : "owns"
    SESSIONS ||--o| REPORTS : "generates"
```

---

### 12. API Flow Diagram
Details the routing architecture within the FastAPI backend.

```mermaid
flowchart LR
    Req["HTTP Request"]
    
    subgraph FastAPI Router
        Auth["/api/auth/*\n(login, register, update)"]
        Query["/api/query\n(run_vqa_query)"]
        Report["/api/reports/*\n(list, generate)"]
        Sys["/api/config, /api/index-status"]
    end
    
    Req --> Auth
    Req --> Query
    Req --> Report
    Req --> Sys
    
    Auth --> DB["db.py"]
    Query --> Pipe["pipeline.py"]
    Query --> DB
    Report --> DB
    Sys --> Pipe
```

---

### 13. Medical Image Processing Pipeline
Shows the lifecycle of a medical image uploaded by the user.

```mermaid
flowchart TD
    A["Frontend Image Upload (File)"]
    B["FileReader (Base64 Encode)"]
    C["FastAPI Form Data Reception"]
    D["Session Cache (Disk Write)"]
    E["PIL.Image Load (RGB)"]
    F["Torchvision Preprocessing\n(Resize 224x224, Normalize)"]
    G["BiomedCLIP Vision Transformer\n(Feature Extraction)"]
    H["Tensor Vector (dim=512)"]
    
    A --> B --> C --> D --> E --> F --> G --> H
```

---

### 14. AI/ML Model Architecture
Visualizes the multi-model architecture combining retrieval and diverse generative engines.

```mermaid
flowchart TB
    subgraph Retrieval Core
        BC["microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224\n(Vision-Language Contrastive Learning)"]
    end
    
    subgraph Generative Engine Switch
        direction LR
        G1["Gemini 1.5 Flash\n(Google API)"]
        G2["Qwen2.5-VL-72B-Instruct\n(HF Inference API)"]
        G3["moondream2\n(Local CPU - 1.6B)"]
        G4["LLaVA-1.5-7b-hf\n(Local GPU 4-bit)"]
    end
    
    Router{"config.GENERATIVE_ENGINE"}
    
    BC --> Router
    Router -->|gemini_api| G1
    Router -->|huggingface_api| G2
    Router -->|local_moondream| G3
    Router -->|local_llava| G4
```