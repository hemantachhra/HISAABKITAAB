import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import InvoicePage from './pages/InvoicePage';
import ReceiptPage from './pages/ReceiptPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

const NavigationMenu = () => {
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black flex justify-around items-center z-[500] md:static md:border-t-0 md:bg-transparent md:mb-8">
      {navItems.map(item => (
        <Link 
          key={item.path} 
          to={item.path} 
          className={`flex-1 flex flex-col items-center py-3 md:py-2 transition-all ${isActive(item.path) ? 'text-indigo-700 font-black' : 'text-gray-400 font-bold hover:text-black'}`}
        >
          {item.icon}
          <span className="text-[10px] uppercase mt-1 tracking-tighter">{item.label}</span>
          {isActive(item.path) && <div className="w-1 h-1 bg-indigo-700 rounded-full mt-0.5"></div>}
        </Link>
      ))}
    </nav>
  );
};

const App = () => {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden w-full">
        <NavigationMenu />
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