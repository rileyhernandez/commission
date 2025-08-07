use crate::error::AppError;
use menu::backend::{ConfigBackend, BACKEND_URL};
use scale::scale::Scale;
use std::env;
use std::path::Path;
use menu::libra::Libra;
use menu::error::Error as MenuError;

pub struct AppData {
    pub scale: Option<Scale>,
    pub empty_calibration_reading: Option<f64>,
    pub backend: Option<ConfigBackend>,
}
impl AppData {
    pub fn new() -> Self {
        Self {
            scale: None,
            empty_calibration_reading: None,
            backend: None,
        }
    }
    pub fn initialize_backend(&mut self) -> Result<(), AppError> {
        if self.backend.is_none() {
            let auth_token = env::var("AUTH_TOKEN")?;
            let backend = ConfigBackend::new(BACKEND_URL.into(), auth_token);
            self.backend = Some(backend);
            Ok(())
        } else {
            Err(AppError::BackendAlreadyInitialized)
        }
    }
    pub fn get_backend(&self) -> Result<ConfigBackend, AppError> {
        if let Some(backend) = &self.backend {
            Ok(backend.clone())
        } else {
            Err(AppError::BackendNotInitialized)
        }
    }
}

pub fn add_or_create_config(libra: Libra, path: &Path) -> Result<(), AppError> {
    if let Err(e) = Libra::add_to_config_file(libra.clone(), path) {
        match e {
            MenuError::FileNotFound => {
                Libra::new_config_file(vec![libra], path)?;
                Ok(())
            }
            MenuError::LibraAlreadyExists => {
                Libra::edit_config_file(libra, path)?;
                Ok(())
            }
            _ => Err(e.into())
        }
    } else {
        Ok(())
    }
}