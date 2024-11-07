import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const RemoveButton = ({ onClick }) => {
  return (
    <Button
      variant="destructive"
      size="icon"
      className="remove-buttonrounded-full w-8 h-8 absolute -top-2 -right-2 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-110 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
      onClick={onClick}
    >
      <X className="h-4 w-4" />
    </Button>
  );
};

export default RemoveButton;
