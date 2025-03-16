import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = ({ setIsLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        setIsLoggedIn(true);
        navigate('/search');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="login-container">
      <h2>Login to PaperPath</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" className="login-button">
          Login
        </button>
      </form>
      <p className="signup-link">
        Don't have an account? <span onClick={() => navigate('/signup')}>Sign up</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#EB5B00"/>
      <stop offset="100%" stopColor="#640D5F"/>
    </linearGradient>
  </defs>

  

  <path d="M100,100 Q75,25 50,50" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q125,25 150,50" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q190,90 170,140" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q10,90 30,140" stroke="url(#grad)" strokeWidth="3" fill="none"/>

  <circle cx="100" cy="100" r="12" fill="url(#grad)" />

  <circle cx="50" cy="50" r="8" fill="#640D5F"/>
  <circle cx="150" cy="50" r="8" fill="#640D5F"/>
  <circle cx="170" cy="140" r="8" fill="#640D5F"/>
  <circle cx="30" cy="140" r="8" fill="#640D5F"/>

  <text x="100" y="180" text-anchor="middle" font-size="24" font-family="Arial, sans-serif"
        font-weight="bold" fill="url(#grad)">
    PaperPath
  </text>
</svg>
      </p>
    </div>
  );
};

export default Login;
