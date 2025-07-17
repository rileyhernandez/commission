// /home/riley/projects/commission/src/HomePage.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import { useTauriCommand } from "./hooks/useTauriCommand";
import ErrorModal from "./components/ErrorModal";
import { Libra, Model, Device } from "./libra.ts";

function HomePage() {
    const [status, setStatus] = useState("Ready to begin.");
    const navigate = useNavigate();

    // State for modals
    const [availablePhidgets, setAvailablePhidgets] = useState<number[]>([]);
    const [isSelectionModalOpen, setSelectionModalOpen] = useState(false);
    const [isConfigModalOpen, setConfigModalOpen] = useState(false);

    // State for the new device being configured
    const [newLibra, setNewLibra] = useState<Libra | null>(null);

    // A single error state for our modal, to be shared by all commands
    const [modalError, setModalError] = useState<string | null>(null);

    // Generic onError handler that all hooks will use
    const onError = (error: string) => {
        setModalError(error);
        setStatus("An error occurred. See details in popup.");
    };

    // --- Hook Definitions ---
    const { execute: findPhidgets, isLoading: isLoadingPhidgets } = useTauriCommand<number[]>('find_connected_phidgets', {
        onSuccess: (result) => {
            if (result && result.length > 0) {
                setAvailablePhidgets(result);
                setSelectionModalOpen(true);
                setStatus("Please select a Phidget to commission as a new device.");
            } else {
                setAvailablePhidgets([]);
                setStatus("No connected Phidgets found.");
            }
        },
        onError, // Using shared error handler
    });

    // The command now returns the newly created `Device` from the backend.
    const { execute: commissionDevice, isLoading: isCommissioning } = useTauriCommand<Device, { model: Model, config: Libra['config'] }>('create_new_device', {
        onSuccess: (newDevice) => {
            // We can safely assume `newLibra` is not null here because `handleCommissionDevice` guards it.
            const commissionedLibra: Libra = {
                device: newDevice, // Use the device details returned from the backend
                config: newLibra!.config, // Use the config the user just entered
            };

            // Navigate to the existing device page, passing the newly created device data.
            // The component will unmount, so no need to clean up state here.
            navigate("/ExistingDevicePage", {
                state: { newlyCommissionedLibra: commissionedLibra }
            });
        },
        onError,
    });

    // --- Event Handlers ---
    const handleNewDeviceClick = () => {
        setStatus("Finding connected Phidgets...");
        findPhidgets();
    };

    const handlePhidgetSelect = (phidgetId: number) => {
        const defaultLibra: Libra = {
            device: {
                model: Model.LibraV0, // Default model for new devices
                number: 0, // Placeholder: The backend will assign the final device number.
            },
            config: {
                phidgetId,
                gain: 1,
                offset: 0,
                loadCellId: 0,
                location: "",
                ingredient: "",
            },
        };

        setNewLibra(defaultLibra);
        setSelectionModalOpen(false); // Close the phidget selection modal
        setConfigModalOpen(true);   // Open the new configuration modal
        setStatus(`Configuring new device for Phidget ID: ${phidgetId}.`);
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!newLibra) return;
        const { name, value, type } = e.target;
        setNewLibra(prevLibra => {
            if (!prevLibra) return null;
            return {
                ...prevLibra,
                config: {
                    ...prevLibra.config,
                    // Handle empty number fields gracefully
                    [name]: type === 'number' ? parseFloat(value) || 0 : value,
                },
            };
        });
    };

    const handleCommissionDevice = () => {
        if (!newLibra) return;
        setStatus(`Commissioning new ${newLibra.device.model} device...`);
        commissionDevice({ model: newLibra.device.model, config: newLibra.config });
    };

    const handleCancelCommission = () => {
        setConfigModalOpen(false);
        setNewLibra(null);
        setStatus("Commissioning cancelled. Ready to begin.");
    };

    // Combine all loading states for disabling parts of the UI
    const isLoading = isLoadingPhidgets || isCommissioning;

    // A helper to make form labels more readable (e.g., "loadCellId" -> "Load Cell Id")
    const formatLabel = (s: string) => {
        const withSpaces = s.replace(/([A-Z])/g, ' $1');
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    };

    return (
        <>
            {/* A single, reusable error modal for the page */}
            <ErrorModal error={modalError} onClose={() => setModalError(null)} />

            <main className="container">
                <h1>Commissioning App</h1>
                <p>Select New or Previously Commissioned Device to Continue</p>
                <div className="row">
                    <button className="button" onClick={() => navigate("/ExistingDevicePage")} disabled={isLoading}>
                        Existing Device
                    </button>
                    <button className="button" onClick={handleNewDeviceClick} disabled={isLoading}>
                        {isLoadingPhidgets ? 'Searching...' : 'New Device'}
                    </button>
                </div>
                <div className="row">
                    <p>Status: {status}</p>
                </div>

                {/* Modal for selecting a Phidget */}
                {isSelectionModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h2>Select a Connected Phidget</h2>
                            <ul className="modal-list">
                                {availablePhidgets.map((phidgetId) => (
                                    <li key={phidgetId} className="list-item">
                                        <span>Phidget ID: {phidgetId}</span>
                                        <button onClick={() => handlePhidgetSelect(phidgetId)}>Select</button>
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => { setSelectionModalOpen(false); setStatus("Ready to begin.")}}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Modal for configuring the new device */}
                {isConfigModalOpen && newLibra && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h2>Configure New Device</h2>
                            <p style={{textAlign: 'center', marginTop: '0.5rem'}}>
                                <strong>Model:</strong> {newLibra.device.model}
                            </p>

                            <div className="form-grid" style={{marginTop: '1.5rem'}}>
                                {Object.entries(newLibra.config).map(([key, value]) => {
                                    const isEditable = ['location', 'ingredient', 'loadCellId'].includes(key);
                                    const label = formatLabel(key);

                                    return (
                                        <div className="form-row" key={key}>
                                            <label htmlFor={key}>{label}</label>
                                            <input
                                                id={key}
                                                name={key}
                                                type={typeof value === 'number' ? 'number' : 'text'}
                                                value={value}
                                                onChange={handleConfigChange}
                                                readOnly={!isEditable}
                                                disabled={isLoading}
                                                placeholder={
                                                    key === 'location' ? "e.g., Kitchen Counter" :
                                                        key === 'ingredient' ? "e.g., Coffee Beans" : ""
                                                }
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="button-group" style={{ justifyContent: 'space-between', marginTop: '2rem' }}>
                                <button onClick={handleCancelCommission} disabled={isLoading}>Cancel</button>
                                <button className="button" onClick={handleCommissionDevice} disabled={isLoading}>
                                    {isCommissioning ? 'Saving...' : 'Commission Device'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

export default HomePage;