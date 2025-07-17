import "./App.css";
// Correctly import from react-router-dom
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import HomePage from "./HomePage.tsx";
import ExistingDevicePage from "./ExistingDevicePage.tsx";

function App() {
    return (
        <BrowserRouter>
            <nav>
                <Link to="/">Home</Link> | <Link to="/ExistingDevicePage">Existing Device</Link>
            </nav>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/ExistingDevicePage" element={<ExistingDevicePage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;