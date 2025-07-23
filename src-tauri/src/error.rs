use log::error;
use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("This feature is not yet implemented!")]
    NotImplemented,
    #[error("Serde failed: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Must validate device with backend before use!")]
    DeviceUnvalidated,
    #[error("Other Error: {0}")]
    Other(String),
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
    #[error("Invalid response from backend: {0}")]
    InvalidResponse(String),
    #[error("No empty calibration value")]
    NoEmptyCalibrationValue,
    #[error("{0}")]
    VarError(#[from] std::env::VarError),
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
