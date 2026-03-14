import React, { useState } from 'react';

export const useRightDrawer = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState<React.ReactNode | null>(null);

    const openDrawer = (view: React.ReactNode) => {
        setContent(view);
        setIsOpen(true);
    };

    const closeDrawer = () => {
        setIsOpen(false);
        setTimeout(() => setContent(null), 200);
    };

    return { isOpen, content, openDrawer, closeDrawer };
};
