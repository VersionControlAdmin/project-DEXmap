import { createContext, useContext, useState } from "react";

const UploadedFilesContext = createContext();
export const useUploadedFilesContext = () => useContext(UploadedFilesContext);
export default function UploadFilesContextProvider({ children }) {
  const [selectedImages, setSelectedImages] = useState([]);
  return (
    <UploadedFilesContext.Provider
      value={{ selectedImages, setSelectedImages}}
    >
      {children}
    </UploadedFilesContext.Provider>
  );
}
