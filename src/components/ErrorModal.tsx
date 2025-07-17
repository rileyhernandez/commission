import '../App.css'; // Uses the modal styles from your existing CSS

interface ErrorModalProps {
    error: string | null;
    onClose: () => void;
}

/**
 * A modal dialog to display application errors.
 * It becomes visible when the `error` prop is not null.
 */
function ErrorModal({ error, onClose }: ErrorModalProps) {
    if (!error) {
        return null;
    }

    return (
        <div className="modal-overlay error-modal-overlay">
            <div className="modal-content">
                <h2>An Error Occurred</h2>
                {/* Style the error message for better visibility */}
                <p style={{
                    color: '#ff4d4f',
                    backgroundColor: 'rgba(255, 77, 79, 0.1)',
                    padding: '1rem',
                    borderRadius: 'var(--border-radius)',
                    margin: '1rem 0',
                    whiteSpace: 'pre-wrap', // Preserve line breaks from error messages
                }}>
                    {error}
                </p>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
}

export default ErrorModal;