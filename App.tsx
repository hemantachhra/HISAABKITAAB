
import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import InvoicePage from './pages/InvoicePage';
import ReceiptPage from './pages/ReceiptPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

const Navigation = () => {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname.startsWith('/edit-invoice');
    if (path === '/receipt') return location.pathname.startsWith('/receipt') || location.pathname.startsWith('/edit-receipt');
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', label: 'Invoice', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> },
    { path: '/receipt', label: 'Receipt', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> },
    { path: '/reports', label: 'Reports', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m0 10v4a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2m4 0h2"></path></svg> },
    { path: '/settings', label: 'Settings', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> }
  ];

  return (
    <>
      {/* Desktop Top Nav */}
      <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">V4</div>
              <span className="text-xl font-bold tracking-tight text-gray-800 italic">Challan Kitab</span>
            </div>
            <div className="flex space-x-8">
              {navItems.map(item => (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`${isActive(item.path) ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-1 font-bold uppercase text-xs tracking-widest transition-colors`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[100] pb-safe">
        <div className="grid grid-cols-4 h-16">
          {navItems.map(item => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex flex-col items-center justify-center space-y-1 ${isActive(item.path) ? 'text-indigo-600' : 'text-gray-400'}`}
            >
              {item.icon}
              <span className="text-[10px] font-bold uppercase">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden w-full">
        <Navigation />
        <main className="flex-1 max-w-5xl mx-auto w-full p-2 md:p-8 pb-20 md:pb-8">
          <Routes>
            <Route path="/" element={<InvoicePage />} />
            <Route path="/edit-invoice/:id" element={<InvoicePage />} />
            <Route path="/receipt" element={<ReceiptPage />} />
            <Route path="/edit-receipt/:id" element={<ReceiptPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
