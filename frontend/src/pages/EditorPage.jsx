import LiveEditor from "../components/LiveEditor";
import { useUploadedFilesContext } from "../context/UploadFiles.context";

const EditorPage = () => {
  const { selectedImages, setSelectedImages } = useUploadedFilesContext();

  return (
    <LiveEditor
      selectedImages={selectedImages}
      setSelectedImages={setSelectedImages}
    />
  );
};

export default EditorPage;
