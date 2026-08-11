import React, { useState, useEffect } from 'react';
import '../landing.css';

interface User {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
}

interface LandingPageProps {
  onAuthSuccess: (user: User) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  const [page, setPage] = useState<'landing' | 'login' | 'signup'>('landing');
  const [particles, setParticles] = useState<{ id: number; left: string; duration: string; delay: string; drift: string; opacity: number }[]>([]);
  
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // Signup states
  const [signupFirst, setSignupFirst] = useState('');
  const [signupLast, setSignupLast] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupErr, setSignupErr] = useState('');

  // Setup animated particles
  useEffect(() => {
    const parts = [];
    for (let i = 0; i < 18; i++) {
      parts.push({
        id: i,
        left: `${Math.random() * 100}%`,
        duration: `${8 + Math.random() * 12}s`,
        delay: `${-Math.random() * 20}s`,
        drift: `${(Math.random() - 0.5) * 80}px`,
        opacity: 0.3 + Math.random() * 0.4
      });
    }
    setParticles(parts);
  }, []);

  const getUsers = (): Record<string, User> => {
    try {
      return JSON.parse(localStorage.getItem('mvqa_users') || '{}');
    } catch (e) {
      return {};
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail || !loginPass) {
      setLoginErr('Please enter your email and password.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });

      if (res.ok) {
        const data = await res.json();
        setLoginErr('');
        localStorage.setItem('mvqa_session', JSON.stringify(data.user));
        onAuthSuccess(data.user);
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.detail) {
          setLoginErr(errData.detail);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend login fallback to local storage', e);
    }

    // Local fallback check
    const users = getUsers();
    const user = users[loginEmail];
    if (!user || user.password !== loginPass) {
      setLoginErr('Invalid email or password.');
      return;
    }
    setLoginErr('');
    localStorage.setItem('mvqa_session', JSON.stringify(user));
    onAuthSuccess(user);
  };

  const handleSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!signupFirst || !signupLast || !signupEmail || !signupPass) {
      setSignupErr('Please fill in all fields.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(signupEmail)) {
      setSignupErr('Enter a valid email address.');
      return;
    }
    if (signupPass.length < 6) {
      setSignupErr('Password must be at least 6 characters.');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: signupFirst,
          lastName: signupLast,
          email: signupEmail,
          password: signupPass
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSignupErr('');
        localStorage.setItem('mvqa_session', JSON.stringify(data.user));
        onAuthSuccess(data.user);
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.detail) {
          setSignupErr(errData.detail);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend register fallback to local storage', e);
    }

    // Local fallback
    const users = getUsers();
    if (users[signupEmail]) {
      setSignupErr('This email is already registered.');
      return;
    }
    
    const newUser: User = {
      firstName: signupFirst,
      lastName: signupLast,
      email: signupEmail,
      password: signupPass
    };
    
    users[signupEmail] = newUser;
    localStorage.setItem('mvqa_users', JSON.stringify(users));
    localStorage.setItem('mvqa_session', JSON.stringify(newUser));
    setSignupErr('');
    onAuthSuccess(newUser);
  };

  return (
    <div className="landing-root">
      {/* GLOBAL SCENE */}
      <div className="scene">
        <div className="scene-gradient"></div>
        <div className="grid-lines"></div>
        <div className="blob blob1"></div>
        <div className="blob blob2"></div>
        <div className="blob blob3"></div>
        <div className="blob blob4"></div>
        <div className="particles" id="particles">
          {particles.map((p) => (
            <div
              key={p.id}
              className="particle"
              style={{
                left: p.left,
                animationDuration: p.duration,
                animationDelay: p.delay,
                opacity: p.opacity,
                ['--drift' as any]: p.drift
              }}
            />
          ))}
        </div>
      </div>

      {/* LANDING VIEW */}
      <div className={`page ${page === 'landing' ? 'active' : ''}`} id="page-landing">
        <nav className="land-nav">
          <div className="nav-logo">
            <div className="logo-orb">🧠</div>
            <span>MedRAG-VQA</span>
            <span className="logo-chip">RAG</span>
          </div>
          <div className="nav-btns">
            <button className="btn-ghost" onClick={() => setPage('login')}>Sign In</button>
            <button className="btn-glow" onClick={() => setPage('signup')}>Get Started →</button>
          </div>
        </nav>

        <div className="hero">
          <div className="hero-badge">
            <span className="live-dot"></span>
            AI-Powered · Radiology · Clinical VQA
          </div>

          <h1 className="hero-h1">
            Your AI Assistant<br />
            for <span className="grad-em">Medical Imaging</span>
          </h1>

          <p className="hero-sub">
            Upload X-rays, MRIs, or CT scans and get instant, evidence-grounded
            clinical insights — powered by state-of-the-art biomedical AI with 96.67%
            accuracy.
          </p>

          <div className="hero-btns">
            <button className="btn-hero btn-hero-p" onClick={() => setPage('signup')}>Start for Free →</button>
            <button className="btn-hero btn-hero-s" onClick={() => setPage('login')}>Sign In</button>
          </div>
        </div>


      </div>

      {/* LOGIN VIEW */}
      <div className={`page ${page === 'login' ? 'active' : ''}`} id="page-login">
        <button className="back-btn" onClick={() => setPage('landing')}>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div className="auth-wrap">
          <form className="auth-card" onSubmit={handleLogin}>
            <div className="auth-logo">
              <div className="logo-orb">🧠</div>
              <span className="auth-logo-txt">MedRAG-VQA</span>
            </div>
            <h2 className="auth-h">Welcome back</h2>
            <p className="auth-sub">Sign in to continue your clinical conversations</p>

            {loginErr && <div className="auth-err show" id="login-err">{loginErr}</div>}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@hospital.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
              />
            </div>
            <button className="btn-auth" type="submit">Sign In</button>
            <div className="auth-divider">or</div>
            <div className="auth-switch">No account? <a onClick={() => setPage('signup')}>Create one →</a></div>
          </form>
        </div>
      </div>

      {/* SIGNUP VIEW */}
      <div className={`page ${page === 'signup' ? 'active' : ''}`} id="page-signup">
        <button className="back-btn" onClick={() => setPage('landing')}>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div className="auth-wrap">
          <form className="auth-card" onSubmit={handleSignup}>
            <div className="auth-logo">
              <div className="logo-orb">🧠</div>
              <span className="auth-logo-txt">MedRAG-VQA</span>
            </div>
            <h2 className="auth-h">Create account</h2>
            <p className="auth-sub">Join MedRAG-VQA — free forever for research & education</p>

            {signupErr && <div className="auth-err show" id="signup-err">{signupErr}</div>}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Jane"
                  value={signupFirst}
                  onChange={(e) => setSignupFirst(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Doe"
                  value={signupLast}
                  onChange={(e) => setSignupLast(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@hospital.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Min. 6 characters"
                value={signupPass}
                onChange={(e) => setSignupPass(e.target.value)}
              />
            </div>
            <button className="btn-auth" type="submit">Create Account</button>
            <div className="auth-divider">or</div>
            <div className="auth-switch">Already registered? <a onClick={() => setPage('login')}>Sign in →</a></div>
          </form>
        </div>
      </div>
    </div>
  );
};
