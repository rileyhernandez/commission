use std::fmt;
use std::path::Path;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use crate::error::AppError;
use menu::backend;
use menu::device::Device;
// use menu::config::{Config, Read};
use menu::libra::{Config, Libra};
use crate::{CONFIG_BACKEND_PATH, CONFIG_PATH};

const BACKEND_URL: &str = "http://127.0.0.1:8080";

pub type ExistingDevice = Device;
pub fn validate(existing_device: ExistingDevice) -> Result<Config, AppError> {
    // let path = Path::new(CONFIG_PATH);
    // Config::read(path).map_err(AppError::Menu)
    Err(AppError::NotImplemented)
}
pub fn get_from_backend(existing_device: ExistingDevice) -> Result<Libra, AppError> {
    let path = Path::new(CONFIG_BACKEND_PATH);
    let backend = backend::ConfigBackend::new(CONFIG_BACKEND_PATH.into());
    backend.get_config(existing_device)?;
    Err(AppError::NotImplemented)
}