import React, { useState, useEffect, useRef } from 'react';
import { X, Check, User as UserIcon, Mail, Key, Sparkles, Camera, Trash2 } from 'lucide-react';
import { User } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (updated: { name: string; email: string; password?: string; avatarColor?: string; profileImage?: string | null }) => Promise<void>;
}

export const AVATAR_GRADIENTS: Record<string, string> = {
  'teal-sky': 'bg-gradient-to-br from-teal-400 to-sky-500',
  'rose-indigo': 'bg-gradient-to-br from-pink-400 to-indigo-500',
  'purple-pink': 'bg-gradient-to-br from-purple-500 to-pink-500',
  'amber-orange': 'bg-gradient-to-br from-amber-400 to-orange-500',
  'emerald-teal': 'bg-gradient-to-br from-emerald-400 to-teal-600',
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  const fullName = `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;
  const [name, setName] = useState(fullName);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [avatarColor, setAvatarColor] = useState(user.avatarColor || 'teal-sky');
  const [profileImage, setProfileImage] = useState<string | null>(user.profileImage || null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(`${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`);
      setEmail(user.email);
      setAvatarColor(user.avatarColor || 'teal-sky');
      setProfileImage(user.profileImage || null);
      setPassword('');
      setError('');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfileImage(ev.target?.result as string);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and Email are required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password && password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        password: password || undefined,
        avatarColor,
        profileImage,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const initials = name.trim().split(/\s+/).map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
  const gradientClass = AVATAR_GRADIENTS[avatarColor] || AVATAR_GRADIENTS['teal-sky'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleApply}
        className="relative w-full max-w-md bg-slate-950 border border-cyan-500/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10 animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-100 text-lg leading-tight">Profile Settings</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Update your account details · Saved to MongoDB</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-5">
          {/* Avatar / Image Preview */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <div className="relative group">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-16 h-16 rounded-xl object-cover shadow-md border-2 border-cyan-500/30" />
              ) : (
                <div className={`w-16 h-16 rounded-xl ${gradientClass} flex items-center justify-center font-black text-xl text-slate-950 transition-all duration-300 shadow-md`}>
                  {initials || '?'}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-cyan-500 border-2 border-slate-950 flex items-center justify-center text-slate-950 hover:bg-cyan-400 transition-all cursor-pointer shadow-lg"
                title="Upload photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-200 block">Profile Photo</span>
              <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                Upload a photo or use your initials with a gradient theme.
              </p>
              {profileImage && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="mt-1.5 text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Remove photo
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {error && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-950/30 text-rose-400 text-xs font-medium animate-fade-in">
              {error}
            </div>
          )}

          {/* Single Name Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold font-mono">
              <UserIcon className="w-3.5 h-3.5 text-cyan-400" /> User Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-xl py-2.5 px-3.5 text-sm text-slate-200"
            />
          </div>

          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold font-mono">
              <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email (Mail)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hospital.com"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-xl py-2.5 px-3.5 text-sm text-slate-200"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold font-mono">
              <Key className="w-3.5 h-3.5 text-cyan-400" /> Change Password (Pass)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-xl py-2.5 px-3.5 text-sm text-slate-200 font-mono"
            />
          </div>

          {/* Avatar Gradient Theme */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold font-mono">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Avatar Gradient Theme
            </label>
            <p className="text-[10px] text-slate-600">Used when no profile photo is uploaded</p>
            <div className="flex gap-3.5 p-3 rounded-xl bg-slate-900/20 border border-slate-800/80 items-center">
              {Object.entries(AVATAR_GRADIENTS).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAvatarColor(key)}
                  className={`w-8 h-8 rounded-lg ${value} border-2 transition-all cursor-pointer ${
                    avatarColor === key ? 'border-cyan-400 scale-110 shadow-lg shadow-cyan-400/20' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  title={key.replace('-', ' → ')}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-900 flex items-center justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="py-2.5 px-6 rounded-xl font-display font-semibold text-xs text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/15 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
