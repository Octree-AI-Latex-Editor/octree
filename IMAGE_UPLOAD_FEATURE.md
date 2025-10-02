# Image Upload Feature

This document describes the image upload functionality for the LaTeX editor, which follows the same pattern as regular file uploads.

## Features

- **Supported Formats**: PNG and JPEG images
- **File Size Limit**: 5MB maximum
- **Storage**: Images are stored as base64 data in the database (same as text files)
- **Database Integration**: File metadata is stored in the existing `files` table
- **UI Integration**: New "Upload Image" option in the file dialog

## How to Use

1. **Access the Upload Dialog**: 
   - Navigate to any project
   - Click the "Add File" button in the sidebar
   - Select the "Upload Image" tab

2. **Upload Process**:
   - Click "Choose Image" to select a PNG or JPEG file
   - Optionally rename the file
   - Click "Upload Image" to complete the upload

3. **File Management**:
   - Uploaded images appear in the sidebar with a green image icon
   - Images can be deleted like other files
   - Images are organized by project

## Technical Implementation

### API Endpoint
- **Route**: `/api/upload-image`
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Parameters**: 
  - `file`: The image file
  - `projectId`: The project ID

### Database Storage
- **Files Table**: Stores file metadata (name, type, size, project_id)
- **Documents Table**: Stores base64 data URL as content (same as text files)
- **Document Type**: `image` for easy identification

### File Processing
- **Conversion**: Images are converted to base64 data URLs
- **Format**: `data:image/png;base64,{base64String}` or `data:image/jpeg;base64,{base64String}`
- **Storage**: Base64 data is stored in the `documents.content` field

### File Validation
- **MIME Types**: `image/png`, `image/jpeg`, `image/jpg`
- **Size Limit**: 5MB
- **Security**: User authentication and project ownership verification

## Image Viewing

When you click on an uploaded image in the sidebar, it opens in a dedicated image viewer with the following features:

### Image Viewer Features
- **Fit to Window**: Images automatically fit the window on load (default mode)
- **Zoom Controls**: Zoom in/out from 25% to 300% for detailed viewing
- **Rotation**: Rotate image in 90-degree increments
- **Fullscreen**: Toggle fullscreen mode for better viewing
- **Download**: Download the original image file
- **Reset**: Reset zoom and rotation to default (returns to fit-to-window)
- **Pan**: Click and drag to pan when zoomed in
- **Keyboard Shortcuts**: 
  - `+` or `=` to zoom in
  - `-` to zoom out
  - `F` to fit to window
  - `R` to rotate
  - `0` to reset
  - `Escape` to exit fullscreen

### Navigation
- Images are accessed the same way as text files: click in the sidebar
- The image viewer replaces the Monaco code editor on the left side
- The PDF viewer remains on the right side, showing LaTeX compilation output
- **Persistent PDF State**: The PDF viewer maintains its state when switching between files/images
- **Client-Side Navigation**: File switching happens without page refresh for smooth experience
- Image files are automatically detected by file extension (.png, .jpg, .jpeg) or document type
- Users can still compile LaTeX documents and see the PDF output while viewing images
- **Global PDF Context**: PDF compilation state persists across file switches for seamless workflow
- **Instant File Switching**: Only the file content area updates when switching files

## Usage in LaTeX

Once uploaded, images can be referenced in LaTeX documents using their base64 data URLs. The images are stored in the same system as other project files, making them easily accessible during LaTeX compilation.

## Integration with Existing System

The image upload feature integrates seamlessly with the existing file management system:
- Uses the same database tables (`files` and `documents`)
- Follows the same upload pattern as text files
- Appears in the same sidebar with appropriate icons
- Can be deleted using the same delete functionality
- Opens in a dedicated viewer when clicked
