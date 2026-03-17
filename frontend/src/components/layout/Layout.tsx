import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ToastStack, useToast } from './ToastStack';
import { Outlet } from 'react-router-dom';

export const Layout: React.FC = () => {
    const { toasts, removeToast, addToast } = useToast();

    return (
        <div className="min-h-screen bg-background text-text-primary selection:bg-accent selection:text-accent-foreground">
            <Header />
            <Sidebar />
            <ToastStack toasts={toasts} onDismiss={removeToast} />
            <main className="ml-[220px] pt-6 pb-12 px-6 min-h-[calc(100vh-48px)]">
                <Outlet context={{ addToast }} />
            </main>
        </div>
    );
};
