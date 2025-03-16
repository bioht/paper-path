import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      // TODO: Implement signup API call
      navigate('/login');
    } catch (err) {
      setError('Error creating account. Please try again.');
    }
  };

  return (
    <div className="signup-container">
      
      <h2>Create Paper Account</h2>
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
        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" className="signup-button">
          Create Account
        </button>
      </form>
      <p className="login-link">
        Already have an account? <span onClick={() => navigate('/login')}>Login</span>
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

export default Signup;
