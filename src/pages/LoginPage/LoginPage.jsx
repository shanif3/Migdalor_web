import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from 'lib/supabaseClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/home');
      } 
      if (event === 'SIGNED_OUT' && session) {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <div className={`login-container ${isDark ? 'dark' : 'light'}`}>
      {/* Theme toggle button */}
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
        {isDark ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

      {/* Animated background */}
      <div className="background-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      
      {/* Noise texture overlay */}
      <div className="noise-overlay"></div>

      {/* Main content */}
      <div className="login-content">
        <div className="content-grid">
          {/* Auth form - centered */}
          <div className="form-section">
            <div className="login-card">
              <div className="card-header">
                <div className="logo-container">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b00a201212578d09f8396/2f970d938_9.png"
                    alt="לוגו מגדלור"
                    className="logo-image"
                  />
                </div>
                <h1 className="welcome-title">ברוכים הבאים למגדלור</h1>
              </div>

              <div className="auth-wrapper">
                <Auth
                  supabaseClient={supabase}
                  localization={{
                    variables: {
                      sign_in: {
                        email_label: 'כתובת אימייל',
                        password_label: 'סיסמה',
                        email_input_placeholder: 'הכנס את האימייל שלך',
                        password_input_placeholder: 'הכנס את הסיסמה שלך',
                        button_label: 'התחבר',
                        loading_button_label: 'מתחבר...',
                        social_provider_text: 'התחבר עם {{provider}}',
                        link_text: 'כבר יש לך חשבון? התחבר',
                      },
                      sign_up: {
                        email_label: 'כתובת אימייל',
                        password_label: 'סיסמה',
                        email_input_placeholder: 'הכנס את האימייל שלך',
                        password_input_placeholder: 'הכנס את הסיסמה שלך',
                        button_label: 'הרשם',
                        loading_button_label: 'נרשם...',
                        social_provider_text: 'הרשם עם {{provider}}',
                        link_text: 'אין לך חשבון? הרשם',
                        confirmation_text: 'בדוק את האימייל שלך לאישור',
                      },
                      forgotten_password: {
                        email_label: 'כתובת אימייל',
                        password_label: 'הכנס את האימייל שלך',
                        email_input_placeholder: 'הכנס את האימייל שלך',
                        button_label: 'שלח הוראות לאיפוס סיסמה',
                        loading_button_label: 'שולח הוראות לאיפוס סיסמה...',
                        link_text: 'שכחת סיסמה?',
                        confirmation_text: 'בדוק את האימייל שלך לאיפוס הסיסמה',
                      },
                      update_password: {
                        password_label: 'סיסמה חדשה',
                        password_input_placeholder: 'הכנס את הסיסמה החדשה שלך',
                        button_label: 'עדכן סיסמה',
                        loading_button_label: 'מעדכן סיסמה...',
                        confirmation_text: 'הסיסמה שלך עודכנה',
                      },
                      verify_otp: {
                        email_input_label: 'כתובת אימייל',
                        email_input_placeholder: 'הכנס את האימייל שלך',
                        phone_input_label: 'מספר טלפון',
                        phone_input_placeholder: 'הכנס את מספר הטלפון שלך',
                        token_input_label: 'קוד אימות',
                        token_input_placeholder: 'הכנס את קוד האימות שלך',
                        button_label: 'אמת קוד',
                        loading_button_label: 'מאמת...',
                      },
                    },
                  }}
                  appearance={{
                    theme: ThemeSupa,
                    variables: {
                      default: {
                        colors: {
                          brand: '#6366f1',
                          brandAccent: '#4f46e5',
                          brandButtonText: 'white',
                          defaultButtonBackground: 'transparent',
                          defaultButtonBackgroundHover: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6',
                          defaultButtonBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
                          defaultButtonText: isDark ? '#ffffff' : '#1f2937',
                          dividerBackground: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
                          inputBackground: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                          inputBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
                          inputBorderHover: isDark ? 'rgba(255, 255, 255, 0.2)' : '#d1d5db',
                          inputBorderFocus: '#6366f1',
                          inputText: isDark ? '#ffffff' : '#1f2937',
                          inputLabelText: isDark ? 'rgba(255, 255, 255, 0.7)' : '#6b7280',
                          inputPlaceholder: isDark ? 'rgba(255, 255, 255, 0.4)' : '#9ca3af',
                        },
                        space: {
                          spaceSmall: '8px',
                          spaceMedium: '16px',
                          spaceLarge: '24px',
                        },
                        borderWidths: {
                          buttonBorderWidth: '1px',
                          inputBorderWidth: '1px',
                        },
                        radii: {
                          borderRadiusButton: '12px',
                          buttonBorderRadius: '12px',
                          inputBorderRadius: '12px',
                        },
                        fontSizes: {
                          baseBodySize: '15px',
                          baseInputSize: '15px',
                          baseLabelSize: '14px',
                          baseButtonSize: '15px',
                        },
                        fonts: {
                          bodyFontFamily: "'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          buttonFontFamily: "'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          inputFontFamily: "'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          labelFontFamily: "'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        },
                      },
                    },
                    className: {
                      container: 'auth-container',
                      button: 'auth-button',
                      input: 'auth-input',
                      label: 'auth-label',
                    }
                  }}
                  providers={["google"]}
                  redirectTo={`${window.location.origin}/auth/v1/callback`}
                />
              </div>

              <div className="card-footer">
                <p className="footer-text">
                  בהמשך, אתה מסכים לתנאי השימוש ולמדיניות הפרטיות שלנו
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="decorative-lines">
          <div className="line line-1"></div>
          <div className="line line-2"></div>
          <div className="line line-3"></div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .login-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          transition: background 0.5s cubic-bezier(0.22, 1, 0.36, 1);
          direction: rtl;
        }

        /* Dark mode */
        .login-container.dark {
          background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
        }

        /* Light mode */
        .login-container.light {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        }

        /* Theme toggle button */
        .theme-toggle {
          position: fixed;
          top: 24px;
          left: 24px;
          z-index: 100;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .dark .theme-toggle {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .light .theme-toggle {
          background: white;
          color: #1f2937;
          border: 1px solid #e5e7eb;
        }

        .theme-toggle:hover {
          transform: translateY(-2px) scale(1.05);
        }

        .dark .theme-toggle:hover {
          background: rgba(255, 255, 255, 0.15);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
        }

        .light .theme-toggle:hover {
          background: #f9fafb;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        /* Animated background orbs */
        .background-orbs {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 1;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: float 20s ease-in-out infinite;
        }

        .dark .orb {
          opacity: 0.3;
        }

        .light .orb {
          opacity: 0.2;
        }

        .orb-1 {
          width: 500px;
          height: 500px;
          top: -10%;
          left: -10%;
          animation-delay: 0s;
        }

        .dark .orb-1 {
          background: radial-gradient(circle, #6366f1 0%, transparent 70%);
        }

        .light .orb-1 {
          background: radial-gradient(circle, #818cf8 0%, transparent 70%);
        }

        .orb-2 {
          width: 400px;
          height: 400px;
          bottom: -10%;
          right: -5%;
          animation-delay: -7s;
        }

        .dark .orb-2 {
          background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
        }

        .light .orb-2 {
          background: radial-gradient(circle, #a78bfa 0%, transparent 70%);
        }

        .orb-3 {
          width: 350px;
          height: 350px;
          top: 50%;
          right: 20%;
          animation-delay: -14s;
        }

        .dark .orb-3 {
          background: radial-gradient(circle, #ec4899 0%, transparent 70%);
        }

        .light .orb-3 {
          background: radial-gradient(circle, #f472b6 0%, transparent 70%);
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(50px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-30px, 30px) scale(0.9);
          }
        }

        /* Noise texture overlay */
        .noise-overlay {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 2;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          pointer-events: none;
        }

        .dark .noise-overlay {
          opacity: 0.03;
        }

        .light .noise-overlay {
          opacity: 0.02;
        }

        /* Main content */
        .login-content {
          position: relative;
          z-index: 3;
          width: 100%;
          max-width: 480px;
          padding: 40px 20px;
        }

        /* Content grid */
        .content-grid {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Form section */
        .form-section {
          width: 100%;
        }

        /* Login card */
        .login-card {
          border-radius: 24px;
          padding: 48px 40px;
          position: relative;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .dark .login-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .light .login-card {
          background: white;
          border: 1px solid #e5e7eb;
          box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }

        .login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
        }

        .dark .login-card::before {
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        }

        .light .login-card::before {
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent);
        }

        /* Card header */
        .card-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .logo-image {
          width: 100px;
          height: auto;
          object-fit: contain;
        }

        .welcome-title {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
          transition: color 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .dark .welcome-title {
          color: white;
        }

        .light .welcome-title {
          color: #1f2937;
        }

        /* Auth wrapper */
        .auth-wrapper {
          margin-bottom: 32px;
        }

        /* Custom auth styling */
        :global(.auth-container) {
          width: 100%;
        }

        :global(.auth-button) {
          font-weight: 500 !important;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;
          height: 48px !important;
        }

        :global(.auth-button:hover) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        :global(.auth-input) {
          height: 48px !important;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;
          text-align: right !important;
        }

        .dark :global(.auth-input) {
          background: rgba(255, 255, 255, 0.05) !important;
          color: white !important;
        }

        .light :global(.auth-input) {
          background: white !important;
          color: #1f2937 !important;
        }

        :global(.auth-input:focus) {
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
        }

        :global(.auth-label) {
          font-weight: 500 !important;
          text-align: right !important;
        }

        /* Card footer */
        .card-footer {
          text-align: center;
        }

        .footer-text {
          font-size: 13px;
          line-height: 1.6;
          transition: color 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .dark .footer-text {
          color: rgba(255, 255, 255, 0.5);
        }

        .light .footer-text {
          color: #9ca3af;
        }

        /* Decorative lines */
        .decorative-lines {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          pointer-events: none;
          z-index: -1;
        }

        .line {
          position: absolute;
          height: 1px;
          animation: shimmer 3s ease-in-out infinite;
        }

        .dark .line {
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent);
        }

        .light .line {
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.2), transparent);
        }

        .line-1 {
          width: 200px;
          top: 20%;
          left: -100px;
          animation-delay: 0s;
        }

        .line-2 {
          width: 250px;
          bottom: 30%;
          right: -125px;
          animation-delay: 1s;
        }

        .line-3 {
          width: 180px;
          top: 60%;
          left: -90px;
          animation-delay: 2s;
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 0;
            transform: translateX(0);
          }
          50% {
            opacity: 1;
            transform: translateX(100px);
          }
        }

        /* Responsive design */
        @media (max-width: 640px) {
          .theme-toggle {
            top: 16px;
            left: 16px;
            width: 44px;
            height: 44px;
          }

          .login-card {
            padding: 32px 24px;
            border-radius: 20px;
          }

          .welcome-title {
            font-size: 28px;
          }

          .logo-image {
            width: 80px;
          }
        }
      `}</style>
    </div>
  );
}