import React from 'react';

interface SidebarToggleButtonProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const SidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({ toggleSidebar, isSidebarOpen }) => {
  return (
    <button
      onClick={toggleSidebar}
      className="sidebar-toggle-button" // Re-use the CSS class
      title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
    >
      ☰
    </button>
  );
};

export default SidebarToggleButton;