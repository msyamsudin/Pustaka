import { useState } from 'react';

/**
 * Custom hook to manage modal states (Alert, Confirm, Toast)
 * Extracted from App.jsx to reduce complexity
 */
export const useModalState = () => {
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: null,
        isDanger: false
    });

    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: "",
        message: ""
    });

    const [toast, setToast] = useState(null); // { message, type }

    // Alert Modal Functions
    const showAlert = (title, message) => {
        setAlertModal({ isOpen: true, title, message });
    };

    const closeAlert = () => {
        setAlertModal({ ...alertModal, isOpen: false });
    };

    // Confirm Modal Functions
    const showConfirm = (title, message, onConfirm, isDanger = false) => {
        setConfirmModal({ isOpen: true, title, message, onConfirm, isDanger });
    };

    const closeConfirm = () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
    };

    // Toast Functions
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    return {
        // States
        confirmModal,
        alertModal,
        toast,

        // Functions
        showAlert,
        closeAlert,
        showConfirm,
        closeConfirm,
        showToast,
        setToast,
    };
};
