import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUploadedFilesContext } from "../context/UploadFiles.context";

const FileUpload = () => {
  // const [selectedImages, setSelectedImages] = useState([]);
  const { selectedImages, setSelectedImages } = useUploadedFilesContext();
  // Function to handle file upload
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const fileArray = files.map((file) => ({
      file, // Store the actual File object
      url: URL.createObjectURL(file), // Store the image preview URL
    }));
    setSelectedImages((prevImages) => prevImages.concat(fileArray));

    // Free memory when the images are removed
    e.target.value = null;
  };

  // Function to remove an image from the preview list
  const removeImage = (url) => {
    setSelectedImages((prevImages) =>
      prevImages.filter((image) => image !== url)
    );
  };

  // Pass files to the editor & route to /map-editor website
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/map-editor");
  };

  return (
    <div className="flex flex-col items-center">
      <label className="w-full flex flex-col items-center px-4 py-6 bg-white text-blue-500 rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue-500 hover:text-white transition duration-300 ease-in-out">
        <svg
          className="w-8 h-8"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M16.5 9H13V3h-2v6H7.5l4.5 4.5L16.5 9z" />
        </svg>
        <span className="mt-2 text-base leading-normal">Upload Photos</span>
        <input
          type="file"
          className="hidden"
          onChange={handleImageUpload}
          multiple
          accept="image/*"
        />
      </label>

      {selectedImages.length > 0 && (
        <button
          onClick={handleSubmit}
          className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg hover:bg-green-700 transition duration-300 ease-in-out"
        >
          Generate Map
        </button>
      )}
      {/* Image Preview */}
      <div className="flex flex-wrap mt-4">
        {selectedImages.map((image, index) => (
          <div key={index} className="relative m-2">
            <img
              src={image.url}
              alt={`Uploaded ${index}`}
              className="w-32 h-32 object-cover rounded-lg shadow-md"
            />
            <button
              onClick={() => removeImage(image)}
              className="absolute top-0 right-0 bg-red-500 text-white rounded-full px-2 py-1 text-xs"
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileUpload;
