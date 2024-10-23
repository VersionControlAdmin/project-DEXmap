import { useState } from 'react'
import './App.css'
import EditorPage from './pages/Editorpage';
import UploadPage from './pages/UploadPage';
import { Routes, Route } from "react-router-dom";

function App() {
  
  return (
    <div className="min-h-screen flex items-center justify-center App">
      <Routes>
        <Route path="/" element ={<UploadPage />}/>
        <Route path="/map-editor" element = {<EditorPage />} />
      </Routes>
    </div>
  );
}

export default App
