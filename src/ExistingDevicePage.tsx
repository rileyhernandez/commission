// /home/riley/projects/commission/src/ExistingDevicePage.tsx

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
// Import createDefaultConfig
import { Libra, Model, Device, EDITABLE_CONFIG_FIELDS, createDefaultConfig } from "./libra.ts";
import { useTauriCommand } from "./hooks/useTauriCommand";
import ErrorModal from "./components/ErrorModal";

// To track where the loaded Libra config came from
type LibraSource = 'cloud' | 'file' | null;

// Create a default config instance to get all keys and their types.
// This is more robust than Object.entries() on potentially incomplete data.
const defaultConfig = createDefaultConfig(0);
const allConfigKeys = Object.keys(defaultConfig) as (keyof typeof defaultConfig)[];


function ExistingDevicePage() {
    const [status, setStatus] = useState("Ready.");
    const [serial, setSerial] = useState(0);
    const [model, setModel] = useState<Model>(Model.LibraV0);
    const [libra, setLibra] = useState<Libra | null>(null);
    const [libraSource, setLibraSource] = useState<LibraSource>(null);

    // State for the device selection modal
    const [availableLibras, setAvailableLibras] = useState<Libra[]>([]);
    const [isSelectionModalOpen, setSelectionModalOpen] = useState(false);

    // State for the deletion process
    const [deletingLibra, setDeletingLibra] = useState<Device | null>(null);
    const [libraToDelete, setLibraToDelete] = useState<Libra | null>(null);
    const [isConfirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);

    // State for the calibration modal
    const [isCalibrationModalOpen, setCalibrationModalOpen] = useState(false);
    // State for multi-step calibration: 1: Empty, 2: Test Weight, 3: Success/Weigh
    const [calibrationStep, setCalibrationStep] = useState<1 | 2 | 3>(1);
    const [testWeight, setTestWeight] = useState(0);
    const [measuredWeight, setMeasuredWeight] = useState<number | null>(null); // To store the result from weigh_scale


    // A single error state for our modal, to be shared by all commands
    const [modalError, setModalError] = useState<string | null>(null);

    const location = useLocation();
    const navigate = useNavigate();

    // Effect to handle newly commissioned device passed via navigation state
    useEffect(() => {
        if (location.state?.newlyCommissionedLibra) {
            const newLibra = location.state.newlyCommissionedLibra as Libra;

            setLibra(newLibra);
            // We set the source to 'cloud' because the device has been created in the backend,
            // making it behave as if it were just loaded from the local config file.
            // This gives the user options to save further changes or sync to the cloud.
            setLibraSource('cloud');
            setStatus(`Loaded newly commissioned device: ${newLibra.device.model}-${newLibra.device.number}`);

            // Clean the location state to prevent this from re-triggering
            navigate(".", { replace: true, state: {} });
        }
    }, [location, navigate]);

    // Generic onError handler that all hooks will use
    const onError = (error: string) => {
        setModalError(error);
        setStatus("An error occurred. See details in popup.");
    };

    // --- Hook Definitions ---
    const { execute: findInCloud, isLoading: isFindingInCloud } = useTauriCommand<Libra, { device: Device }>('get_config_from_cloud', {
        onSuccess: (result) => {
            setStatus(`Device found: ${result.device.model}-${result.device.number}`);
            setLibra(result);
            setLibraSource('cloud'); // Set the source to 'cloud'
        },
        onError,
    });

    const { execute: loadFromFile, isLoading: isLoadingFromFile } = useTauriCommand<Libra[]>('load_existing_config_file', {
        onSuccess: (result) => {
            if (result && result.length > 0) {
                setAvailableLibras(result);
                setSelectionModalOpen(true);
                setStatus("Please select a device from the configuration file.");
            } else {
                setStatus("No devices found in the config file.");
            }
        },
        onError,
    });

    const handleConnectError = (error: string, payload?: { libra: Libra }) => {
        if (error.includes("Scale Already Connected")) {
            setStatus(`Scale already connected. Opening calibration interface for ${payload?.libra.device.model}-${payload?.libra.device.number}.`);
            // Reset calibration state before opening the modal
            setCalibrationStep(1);
            setTestWeight(0);
            setMeasuredWeight(null);
            setCalibrationModalOpen(true);
        } else {
            onError(error);
        }
    };

    const { execute: connectAndCalibrate, isLoading: isConnectingForCalibration } = useTauriCommand<void, { libra: Libra }>('connect_scale', {
        onSuccess: (_, payload) => {
            setStatus(`Connected to ${payload?.libra.device.model}-${payload?.libra.device.number}. Opening calibration interface.`);
            // Reset calibration state before opening the modal
            setCalibrationStep(1);
            setTestWeight(0);
            setMeasuredWeight(null);
            setCalibrationModalOpen(true);
        },
        onError: handleConnectError,
    });

    // Command to perform the first step of calibration (empty scale)
    const { execute: calibrateEmpty, isLoading: isCalibratingEmpty } = useTauriCommand<void, { libra: Libra }>('calibrate_empty', {
        onSuccess: () => {
            setStatus("Empty calibration successful. Please place test weight and enter the value.");
            setCalibrationStep(2); // Move to the next step
        },
        onError,
    });

    // Command to perform the second step of calibration (with test weight)
    const { execute: finishCalibration, isLoading: isFinishingCalibration } = useTauriCommand<Libra, { libra: Libra; testWeight: number }>('finish_calibration', {
        onSuccess: (updatedLibra) => {
            setLibra(updatedLibra); // Update state with the newly calibrated device data
            setStatus("Calibration finished successfully! You can now test the scale.");
            setCalibrationStep(3); // Move to the success/weigh step
            setMeasuredWeight(null); // Clear any previous measurement
        },
        onError,
    });

    // Command to get a weight reading from the scale
    const { execute: weighScale, isLoading: isWeighing } = useTauriCommand<number, { libra: Libra }>('weigh_scale', {
        onSuccess: (weight) => {
            setMeasuredWeight(weight);
            setStatus(`Measured weight: ${weight.toFixed(2)} g`);
        },
        onError,
    });

    const { execute: saveChanges, isLoading: isSaving } = useTauriCommand<void, { libra: Libra }>('save_libra_changes', {
        onSuccess: () => {
            setLibra(null);
            setLibraSource(null); // Clear the source on save
            setStatus(`Changes saved to backend.`);
        },
        onError,
    });

    // This hook is specifically for saving the calibrated data from the modal.
    const { execute: saveCalibration, isLoading: isSavingCalibration } = useTauriCommand<void, { libra: Libra }>('save_libra_changes', {
        onSuccess: () => {
            setStatus('Calibration data saved successfully.');
            // Close modal and reset its state
            setCalibrationModalOpen(false);
            setCalibrationStep(1);
            setTestWeight(0);
            setMeasuredWeight(null);
            // Also clear the main component's state for the device
            // setLibra(null);
            // setLibraSource(null);
        },
        onError, // Re-use the global error handler
    });

    const { execute: addToConfigFile, isLoading: isAddingToConfigFile } = useTauriCommand<void, { libra: Libra }>('add_to_config_file', {
        onSuccess: () => {
            setLibra(null);
            setLibraSource(null); // Clear the source on save
            setStatus(`Changes saved to backend.`);
        },
        onError,
    });

    const { execute: pushToCloud, isLoading: isPushingToCloud } = useTauriCommand<void, { libra: Libra }>('push_changes_to_cloud', {
        onSuccess: () => {
            setStatus(`Changes pushed to cloud successfully.`);
        },
        onError,
    });

    const { execute: removeFromConfig, isLoading: isRemovingFromConfig } = useTauriCommand<void, { device: Device }>('remove_from_config_file', {
        onSuccess: (_, payload) => {
            if (!payload) return;

            setAvailableLibras(prevLibras => {
                const updatedLibras = prevLibras.filter(libra =>
                    !(libra.device.model === payload.device.model && libra.device.number === payload.device.number)
                );

                if (updatedLibras.length === 0) {
                    setSelectionModalOpen(false);
                    setStatus("All devices removed from config file.");
                }

                return updatedLibras;
            });

            setStatus(`Device ${payload.device.model}-${payload.device.number} removed from config.`);
            setDeletingLibra(null);
            setLibraToDelete(null);
        },
        onError: (error) => {
            onError(error);
            setDeletingLibra(null);
            setLibraToDelete(null);
        },
    });


    // --- Event Handlers ---
    const findExistingDevice = () => {
        setStatus("Finding device in cloud...");
        findInCloud({ device: { model, number: serial } });
    };

    const loadExistingConfigFile = () => {
        setStatus("Loading config file...");
        setLibra(null);
        setLibraSource(null); // Clear the source when loading a new file
        loadFromFile();
    };

    const handleLibraSelect = (selectedLibra: Libra) => {
        setLibra(selectedLibra);
        setLibraSource('file'); // Set the source to 'file'
        setSelectionModalOpen(false);
        setStatus(`Selected: ${selectedLibra.device.model}-${selectedLibra.device.number}`);
    };

    const handleRequestDelete = (libra: Libra) => {
        setLibraToDelete(libra);
        setConfirmDeleteModalOpen(true);
    };

    const handleCancelDelete = () => {
        setConfirmDeleteModalOpen(false);
        setLibraToDelete(null);
    };

    const handleConfirmDelete = () => {
        if (!libraToDelete) return;

        setConfirmDeleteModalOpen(false);
        setDeletingLibra(libraToDelete.device);
        setStatus(`Removing ${libraToDelete.device.model}-${libraToDelete.device.number}...`);
        removeFromConfig({ device: libraToDelete.device });
    };



    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!libra) return;
        const { name, value, type } = e.target;
        setLibra(prevLibra => {
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

    // The calibrate button handler is now simpler.
    const handleCalibrateClick = async () => {
        if (!libra) {
            setStatus("Please select a device before calibrating.");
            return;
        }
        setStatus(`Attempting to connect to ${libra.device.model}-${libra.device.number} for calibration...`);
        // Simply execute the command. The hook's callbacks will handle success or failure.
        await connectAndCalibrate({ libra });
    };

    const handleFinishCalibration = () => {
        if (!libra || testWeight <= 0) {
            onError("Please enter a valid, positive test weight.");
            return;
        }
        finishCalibration({ libra, testWeight });
    };

    const handleCloseCalibrationModal = () => {
        setCalibrationModalOpen(false);
        setCalibrationStep(1);
        setTestWeight(0);
        setMeasuredWeight(null);
        setStatus("Ready.");
    };

    const handleSaveAndCloseCalibration = () => {
        if (!libra) return;
        saveCalibration({ libra });
    };

    // A helper to make form labels more readable (e.g., "loadCellId" -> "Load Cell Id")
    const formatLabel = (s: string) => {
        const withSpaces = s.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    };



    // Combine all loading states for disabling parts of the UI
    const isLoading = isFindingInCloud || isLoadingFromFile || isConnectingForCalibration || isSaving || isAddingToConfigFile || isPushingToCloud || isRemovingFromConfig || isCalibratingEmpty || isFinishingCalibration || isWeighing || isSavingCalibration;

    return (
        <>
            <ErrorModal error={modalError} onClose={() => setModalError(null)} />

            <main className="container">
                <h1>Find Existing Device</h1>

                <h2>Device Type:</h2>
                <div className="row">
                    <select value={model} onChange={(e) => setModel(e.target.value as Model)} disabled={isLoading}>
                        {Object.values(Model).map((modelName) => (
                            <option key={modelName} value={modelName}>{modelName}</option>
                        ))}
                    </select>
                </div>

                <div className="row" style={{ alignItems: "stretch", gap: "1rem", marginBottom: "1rem" }}>
                    <div className="card" style={{ flex: 1 }}>
                        <h2>From Cloud</h2>
                        <div className="button-grid">
                            <input
                                onChange={(e) => setSerial(parseInt(e.target.value, 10) || 0)}
                                type="number" min="0" value={serial}
                                placeholder="Enter Serial Number"
                                disabled={isLoading}
                            />
                            <button onClick={findExistingDevice} disabled={isLoading}>
                                {isFindingInCloud ? 'Finding...' : 'Find'}
                            </button>
                        </div>
                    </div>
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h2>From Config File</h2>
                        <div className="row">
                            <button onClick={loadExistingConfigFile} disabled={isLoading}>
                                {isLoadingFromFile ? 'Loading...' : 'Load from File'}
                            </button>
                        </div>
                    </div>
                </div>


                {libra && (
                    <div className="card">
                        <h3>Selected Device Details</h3>
                        <p>
                            <strong>Device:</strong> {libra.device.model}-{libra.device.number}
                            <br />
                            <small><em>(Source: {libraSource === 'cloud' ? 'Cloud' : 'Config File'})</em></small>
                        </p>

                        <h4>Configuration</h4>
                        <div className="form-grid">
                            {allConfigKeys.map((key) => {
                                // Get the value from the actual libra config.
                                const value = libra.config[key as keyof typeof libra.config];
                                const isEditable = EDITABLE_CONFIG_FIELDS.includes(key);
                                const label = formatLabel(key);
                                // Determine the input type from our default config object.
                                const inputType = typeof defaultConfig[key] === 'number' ? 'number' : 'text';

                                return (
                                    <div className="form-row" key={key}>
                                        <label htmlFor={key}>{label}</label>
                                        <input
                                            id={key}
                                            name={key}
                                            type={inputType}
                                            value={value ?? ''} // Use nullish coalescing for potentially undefined values
                                            onChange={handleConfigChange}
                                            readOnly={!isEditable}
                                            disabled={isLoading}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="button-group">
                            <button onClick={handleCalibrateClick} disabled={isLoading}>
                                {isConnectingForCalibration ? 'Connecting...' : 'Calibrate'}
                            </button>

                            {/* --- CONTEXTUAL BUTTONS --- */}
                            {libraSource === 'cloud' && (
                                // If from cloud, the main action is to save it to the local config file.
                                <button onClick={() => addToConfigFile({ libra })} disabled={isLoading}>
                                    {isAddingToConfigFile ? 'Saving...' : 'Add to Config File'}
                                </button>
                            )}

                            {libraSource === 'file' && (
                                // If from a local file, we can save local edits or push them to the cloud.
                                <>
                                    <button onClick={() => saveChanges({ libra })} disabled={isLoading}>
                                        {isSaving ? 'Saving...' : 'Save Changes Locally'}
                                    </button>
                                    <button onClick={() => pushToCloud({ libra })} disabled={isLoading}>
                                        {isPushingToCloud ? 'Syncing...' : 'Sync Changes to Cloud'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="row">
                    <p>Status: {status}</p>
                </div>
            </main>

            {isSelectionModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Select a Device</h2>
                        <ul className="modal-list">
                            {availableLibras.map((item, index) => {
                                const isCurrentItemDeleting = isRemovingFromConfig && deletingLibra &&
                                    deletingLibra.model === item.device.model &&
                                    deletingLibra.number === item.device.number;

                                // Dynamically create a description from editable string fields that have a value
                                const description = EDITABLE_CONFIG_FIELDS
                                    .map(key => item.config[key as keyof typeof item.config])
                                    .filter(value => typeof value === 'string' && value)
                                    .join(' - ');

                                return (
                                    <li key={`${item.device.model}-${item.device.number}-${index}`} className="list-item">
                                        <span>
                                            {item.device.model}-{item.device.number}
                                            {description && (
                                                <>
                                                    <br />
                                                    <small>({description})</small>
                                                </>
                                            )}
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleLibraSelect(item)} disabled={isLoading}>
                                                Select
                                            </button>
                                            <button
                                                onClick={() => handleRequestDelete(item)}
                                                style={{ backgroundColor: '#dc3545', color: 'white' }}
                                                disabled={isLoading}
                                            >
                                                {isCurrentItemDeleting ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <button onClick={() => setSelectionModalOpen(false)} disabled={isLoading}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {isConfirmDeleteModalOpen && libraToDelete && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Confirm Deletion</h2>
                        <p>
                            Are you sure you want to remove device <br />
                            <strong>{libraToDelete.device.model}-{libraToDelete.device.number}</strong>
                            <br />from the configuration file?
                        </p>
                        <p><small>This action cannot be undone.</small></p>
                        <div className="button-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button onClick={handleCancelDelete} disabled={isRemovingFromConfig}>
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                style={{ backgroundColor: '#dc3545', color: 'white' }}
                                disabled={isRemovingFromConfig}
                            >
                                {isRemovingFromConfig ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCalibrationModalOpen && libra && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Calibrate Device</h2>
                        <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            Calibrating <strong>{libra.device.model}-{libra.device.number}</strong>
                        </p>

                        {calibrationStep === 1 && (
                            <>
                                <p style={{ textAlign: 'center' }}>
                                    Ensure the scale is empty, then begin calibration.
                                </p>
                                <div className="button-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button onClick={handleCloseCalibrationModal} disabled={isCalibratingEmpty}>
                                        Close
                                    </button>
                                    <button
                                        onClick={() => calibrateEmpty({ libra })}
                                        disabled={isCalibratingEmpty}
                                        className="button"
                                    >
                                        {isCalibratingEmpty ? 'Starting...' : 'Start'}
                                    </button>
                                </div>
                            </>
                        )}

                        {calibrationStep === 2 && (
                            <>
                                <p style={{ textAlign: 'center' }}>
                                    Place test weight and enter amount to finish.
                                </p>
                                <div className="form-field" style={{ justifyContent: 'center', margin: '1.5rem 0' }}>
                                    <label htmlFor="testWeight">Test Weight (g)</label>
                                    <input
                                        id="testWeight"
                                        type="number"
                                        value={testWeight || ''}
                                        onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0)}
                                        placeholder="e.g., 1000"
                                        disabled={isFinishingCalibration}
                                        style={{ maxWidth: '150px' }}
                                    />
                                </div>
                                <div className="button-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button onClick={handleCloseCalibrationModal} disabled={isFinishingCalibration}>
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleFinishCalibration}
                                        disabled={isFinishingCalibration || testWeight <= 0}
                                        className="button"
                                    >
                                        {isFinishingCalibration ? 'Finishing...' : 'Continue'}
                                    </button>
                                </div>
                            </>
                        )}

                        {calibrationStep === 3 && (
                            <>
                                <h3 style={{ color: '#28a745' }}>Calibration Successful!</h3>
                                <p style={{ textAlign: 'center' }}>
                                    You can now place an object on the scale and test the calibration.
                                </p>

                                <div className="card" style={{ padding: '1rem', margin: '1.5rem 0', backgroundColor: 'var(--color-background)' }}>
                                    <h4 style={{
                                        marginTop: 0,
                                        marginBottom: '0.75rem',
                                        borderBottom: '1px solid var(--color-border)',
                                        paddingBottom: '0.5rem'
                                    }}>
                                        New Calibration Data
                                    </h4>
                                    <p><strong>Device:</strong> {libra.device.model}-{libra.device.number}</p>
                                    <p><strong>Gain:</strong> {libra.config.gain.toPrecision(8)}</p>
                                    <p><strong>Offset:</strong> {libra.config.offset.toFixed(2)}</p>
                                </div>

                                <div style={{
                                    textAlign: 'center',
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold',
                                    margin: '1.5rem 0',
                                    fontFamily: 'monospace',
                                    color: measuredWeight === null ? 'var(--color-border)' : 'var(--color-primary)',
                                    backgroundColor: 'var(--color-background)',
                                    padding: '1rem',
                                    borderRadius: 'var(--border-radius)'
                                }}>
                                    {measuredWeight !== null ? `${measuredWeight.toFixed(2)} g` : '--.-- g'}
                                </div>

                                <div className="button-group" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
                                    <button onClick={handleSaveAndCloseCalibration} disabled={isWeighing || isSavingCalibration}>
                                        {isSavingCalibration ? 'Saving...' : 'Save Locally'}
                                    </button>
                                    <button
                                        onClick={() => weighScale({ libra })}
                                        disabled={isWeighing || isSavingCalibration}
                                        className="button"
                                    >
                                        {isWeighing ? 'Weighing...' : 'Weigh'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default ExistingDevicePage;