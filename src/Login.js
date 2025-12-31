import React, { useState } from 'react';

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem('mockUsers') || '[]');
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  try { localStorage.setItem('mockUsers', JSON.stringify(users)); } catch (e) { /* ignore */ }
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const isValidEmail = (e) => {
    if (!e) return false;
    // simple RFC-like check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  };

  const passwordIssues = (p) => {
    if (!p || p.length < 8) return 'Password must be at least 8 characters';
    if (!/[0-9]/.test(p)) return 'Password must include a number';
    if (!/[a-z]/.test(p)) return 'Password must include a lowercase letter';
    if (!/[A-Z]/.test(p)) return 'Password must include an uppercase letter';
    return null;
  };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const user = username.trim();
    if (!user) return setError('Please enter a username');

    const users = loadUsers();

    if (mode === 'signup') {
      if (!email.trim()) return setError('Please enter an email');
      if (!isValidEmail(email.trim())) return setError('Please enter a valid email address');
      const passErr = passwordIssues(password);
      if (passErr) return setError(passErr);
      if (password !== confirm) return setError('Passwords do not match');
      if (users.find(u => u.username === user)) return setError('Username already taken');
      if (users.find(u => u.email === email.trim())) return setError('An account with this email already exists');

      const newUser = { username: user, email: email.trim(), password };
      users.push(newUser);
      saveUsers(users);
      onLogin({ username: user });
      return;
    }

    // login mode
    const found = users.find(u => u.username === user || u.email === user);
    if (found) {
      if (found.password !== password) return setError('Invalid credentials');
      onLogin({ username: found.username });
      return;
    }

    // No stored users: allow login as a convenience (mock)
    onLogin({ username: user });
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
        {error && <div className="login-error">{error}</div>}
        <label>
          Username
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your name" />
        </label>

        {mode === 'signup' && (
          <label>
            Email
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
        )}

        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" />
        </label>
        {mode === 'signup' && (
          <label>
            Confirm Password
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="confirm password" />
          </label>
        )}

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
          <div style={{fontSize:13, display:'flex', alignItems:'center', gap:8}}>
            {mode === 'login' ? (
              <>
                <span>Don't have an account?</span>
                <button type="button" className="run-btn inline-run-btn" onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
              </>
            ) : (
              <>
                <span>Have an account?</span>
                <button type="button" className="run-btn inline-run-btn" onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
              </>
            )}
          </div>
          <div className="login-actions">
            <button type="submit" className="run-btn">{mode === 'login' ? 'Sign In' : 'Create'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

