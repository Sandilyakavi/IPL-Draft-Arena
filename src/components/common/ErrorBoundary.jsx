import React from 'react';

/**
 * ErrorBoundary
 * =================================================================
 * Production-safe React Error Boundary.
 * Catches unhandled render errors, displays a friendly fallback UI,
 * provides a reload/retry action, and avoids exposing stack traces to users.
 * =================================================================
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b12] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 text-3xl">
              🏏
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-white">
                Something unexpected happened
              </h2>
              <p className="text-sm text-slate-400 font-medium">
                IPL Draft Arena encountered a temporary rendering issue. Your game state in local storage remains safe.
              </p>
            </div>

            <button
              onClick={this.handleReload}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
