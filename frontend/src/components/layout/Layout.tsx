import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ToastStack, useToast } from './ToastStack';
import { Outlet } from 'react-router-dom';

export const Layout: React.FC = () => {
    const { toasts, removeToast } = useToast();

    return (
        <div className="min-h-screen bg-fs-bg-light dark:bg-fs-bg-dark text-fs-text-light dark:text-fs-text-dark selection:bg-fs-cyan selection:text-black">
            <Header />
            <Sidebar />
            <ToastStack toasts={toasts} onDismiss={removeToast} />
            <main className="ml-60 pt-4 pb-12 px-8 min-h-[calc(100vh-56px)]">
                <Outlet context={{ addToast: useToast().addToast }} />
            </main>
        </div>
    );
};
