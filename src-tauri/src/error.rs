use log::error;
use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Serde failed: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Error with config file: {0}")]
    Menu(#[from] menu::error::Error),
    #[error("Scale Error: {0}")]
    Scale(#[from] scale::error::Error),
    #[error("No Scale Connected")]
    NoScaleConnected,
    #[error("Scale Already Connected")]
    ScaleAlreadyConnected,
    #[error("Reqwest Error: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("No empty calibration value")]
    NoEmptyCalibrationValue,
    #[error("{0}")]
    VarError(#[from] std::env::VarError),
    #[error("Backend not initialized")]
    BackendNotInitialized,
    #[error("Backend already initialized")]
    BackendAlreadyInitialized,
    #[error("Tauri Error: {0}")]
    Tauri(#[from] tauri::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        error!("{self}");
        serializer.serialize_str(self.to_string().as_ref())
    }
}
