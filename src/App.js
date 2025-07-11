import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- Color Palettes ---
const colorPalettes = [
  {
    name: 'Vibrant & High Contrast',
    colors: ['#FFFFFF', '#000000', '#FFFF00', '#FF0000', '#00FFFF', '#00FF00'],
  },
  {
    name: 'Corporate & Clean',
    colors: ['#004085', '#155724', '#721c24', '#383d41', '#F8F9FA', '#007BFF'],
  },
  {
    name: 'Social Media Pop',
    colors: ['#FF4500', '#FFD700', '#1E90FF', '#F400A1', '#32CD32', '#FFFFFF'],
  },
];


// --- Helper Functions for Canvas Drawing ---

// Draws the text with all its new features
const drawText = (ctx, element) => {
  const { text, x, y, width, font, size, color, align, shadow, bgColor, stroke, rotation } = element;
  const lineHeight = size * 1.2;

  ctx.save(); // Save context for rotation
  ctx.translate(x + width / 2, y + element.height / 2);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.translate(-(x + width / 2), -(y + element.height / 2));

  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  // Shadow
  ctx.shadowColor = shadow.enabled ? shadow.color : 'transparent';
  ctx.shadowBlur = shadow.enabled ? shadow.blur : 0;
  ctx.shadowOffsetX = shadow.enabled ? shadow.offsetX : 0;
  ctx.shadowOffsetY = shadow.enabled ? shadow.offsetY : 0;

  // Text Wrapping
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > width && n > 0) {
      lines.push(line);
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  const totalHeight = lines.length * lineHeight;

  // Background
  if (bgColor.enabled) {
    ctx.fillStyle = bgColor.color;
    ctx.fillRect(x, y, width, totalHeight);
  }

  // Draw the actual text (with stroke if enabled)
  ctx.fillStyle = color;
  lines.forEach((l, i) => {
    let drawX = x;
    if (align === 'center') drawX = x + width / 2;
    if (align === 'right') drawX = x + width;
    
    if (stroke.enabled) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.strokeText(l.trim(), drawX, y + (i * lineHeight));
    }
    ctx.fillText(l.trim(), drawX, y + (i * lineHeight));
  });

  ctx.restore(); // Restore context to remove rotation
};

// Draws the improved interactive bounding box
const drawBoundingBox = (ctx, box) => {
  ctx.save();
  ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
  ctx.rotate(box.rotation * Math.PI / 180);
  ctx.translate(-(box.x + box.width / 2), -(box.y + box.height / 2));

  ctx.strokeStyle = '#00aeff';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  ctx.setLineDash([]);

  const handleSize = 12;
  ctx.fillStyle = '#00aeff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  // Resize handles
  const handles = [
    { x: box.x, y: box.y }, // top-left
    { x: box.x + box.width, y: box.y }, // top-right
    { x: box.x, y: box.y + box.height }, // bottom-left
    { x: box.x + box.width, y: box.y + box.height }, // bottom-right
  ];
  handles.forEach(handle => {
    ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
  });
  
  ctx.restore();
};

// --- Main App Component ---

const initialTextElements = [
  {
    id: uuidv4(),
    type: 'title',
    text: 'Your Title Here',
    font: 'Lobster',
    size: 50,
    color: '#FFFFFF',
    align: 'center',
    x: 50, y: 50, width: 400, height: 60,
    rotation: 0,
    shadow: { enabled: true, color: 'rgba(0,0,0,0.7)', blur: 5, offsetX: 5, offsetY: 5 },
    bgColor: { enabled: false, color: 'rgba(0,0,0,0.5)' },
    stroke: { enabled: false, color: '#000000', width: 2 },
  },
  {
    id: uuidv4(),
    type: 'explanation',
    text: 'Your explanation text goes here. It will wrap automatically.',
    font: 'Roboto',
    size: 25,
    color: '#FFFFFF',
    align: 'center',
    x: 50, y: 150, width: 500, height: 100,
    rotation: 0,
    shadow: { enabled: true, color: 'rgba(0,0,0,0.7)', blur: 5, offsetX: 2, offsetY: 2 },
    bgColor: { enabled: false, color: 'rgba(0,0,0,0.5)' },
    stroke: { enabled: false, color: '#000000', width: 2 },
  }
];

const initialImageFilters = { brightness: 100, contrast: 100, grayscale: 0, sepia: 0 };

const initialState = {
  textElements: initialTextElements,
  imageFilters: initialImageFilters,
};


function App() {
  // --- State Declarations ---
  const [image, setImage] = useState(null);
  const [imageFilters, setImageFilters] = useState(initialState.imageFilters);
  const [textElements, setTextElements] = useState(initialState.textElements);
  const [activeElementId, setActiveElementId] = useState(null);
  const [interaction, setInteraction] = useState({ type: null });
  const [guidelines, setGuidelines] = useState([]);
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);

  // History for Undo/Redo
  const [history, setHistory] = useState([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const fonts = ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway', 'Merriweather', 'Playfair Display', 'Dancing Script', 'Lobster', 'Pacifico', 'Caveat', 'Bangers', 'Creepster'];

  // --- History Management ---
  const updateHistory = (newState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  const commitChanges = (updatedState) => {
    const newState = updatedState || { textElements, imageFilters };
    updateHistory(newState);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const previousState = history[newIndex];
      setTextElements(previousState.textElements);
      setImageFilters(previousState.imageFilters);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextState = history[newIndex];
      setTextElements(nextState.textElements);
      setImageFilters(nextState.imageFilters);
    }
  };

  // --- Canvas Drawing Logic ---
  const redrawCanvas = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;

    // Apply Image Filters
    ctx.filter = `brightness(${imageFilters.brightness}%) contrast(${imageFilters.contrast}%) grayscale(${imageFilters.grayscale}%) sepia(${imageFilters.sepia}%)`;
    ctx.drawImage(image, 0, 0);
    ctx.filter = 'none'; // Reset filter for text

    // Draw each text element
    textElements.forEach(element => {
      drawText(ctx, element);
      if (element.id === activeElementId) {
        drawBoundingBox(ctx, element);
      }
    });
  }, [image, textElements, activeElementId, imageFilters]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // --- Text Element Management ---
  const addTextElement = () => {
    const newElement = {
      id: uuidv4(),
      text: 'New Text',
      font: 'Roboto',
      size: 40,
      color: '#FFFFFF',
      align: 'center',
      x: 100, y: 100, width: 250, height: 50,
      rotation: 0,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.7)', blur: 5, offsetX: 2, offsetY: 2 },
      bgColor: { enabled: false, color: 'rgba(0,0,0,0.5)' },
      stroke: { enabled: false, color: '#000000', width: 2 },
    };
    const newTextElements = [...textElements, newElement];
    setTextElements(newTextElements);
    updateHistory({ textElements: newTextElements, imageFilters });
    setActiveElementId(newElement.id);
  };

  const deleteActiveElement = () => {
    if (!activeElementId) return;
    const newTextElements = textElements.filter(el => el.id !== activeElementId);
    setTextElements(newTextElements);
    updateHistory({ textElements: newTextElements, imageFilters });
    setActiveElementId(null);
  };

  const updateElement = (id, properties) => {
    const newTextElements = textElements.map(el => {
      if (el.id === id) {
        return { ...el, ...properties };
      }
      return el;
    });
    setTextElements(newTextElements);
    return newTextElements;
  };
  
  const handleElementChange = (prop, value) => {
    if (!activeElementId) return;
    updateElement(activeElementId, { [prop]: value });
  };
  
  const handleNestedChange = (prop, nestedProp, value) => {
    if (!activeElementId) return;
    const element = textElements.find(el => el.id === activeElementId);
    if (element) {
      const updatedNestedProp = { ...element[prop], [nestedProp]: value };
      updateElement(activeElementId, { [prop]: updatedNestedProp });
    }
  };

  const handleColorSwatchClick = (color) => {
    if (!activeElementId) return;
    const newTextElements = textElements.map(el => 
      el.id === activeElementId ? { ...el, color: color } : el
    );
    setTextElements(newTextElements);
    updateHistory({ textElements: newTextElements, imageFilters });
  };

  const handleRotationChange = (value) => {
    if (!activeElementId) return;
    updateElement(activeElementId, { rotation: value });
  };

  const handleRotationMouseUp = () => {
    if (!activeElementId) return;
    
    const snapThreshold = 4; // degrees
    const snapPoints = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
    const element = textElements.find(el => el.id === activeElementId);
    let newRotation = element.rotation;

    for (const point of snapPoints) {
      if (Math.abs(element.rotation - point) <= snapThreshold) {
        newRotation = point;
        break;
      }
    }
    
    const newTextElements = updateElement(activeElementId, { rotation: newRotation });
    commitChanges({ textElements: newTextElements, imageFilters });
  };

  const resetRotation = () => {
    if (!activeElementId) return;
    const newTextElements = updateElement(activeElementId, { rotation: 0 });
    commitChanges({ textElements: newTextElements, imageFilters });
  };

  // --- Event Handlers for Direct Manipulation ---
  const getMousePos = (canvas, evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  };

  const getHandle = (pos, box) => {
    const handleSize = 20; // Larger hit area
    if (pos.x > box.x + box.width - handleSize / 2 && pos.x < box.x + box.width + handleSize / 2 &&
        pos.y > box.y + box.height - handleSize / 2 && pos.y < box.y + box.height + handleSize / 2) return 'br';
    // Can add more handles: 'tl', 'tr', 'bl', 't', 'b', 'l', 'r'
    return null;
  }

  const handleMouseDown = (e) => {
    if (!image) return;
    const pos = getMousePos(canvasRef.current, e);
    
    // Check for interaction in reverse order (top elements first)
    for (let i = textElements.length - 1; i >= 0; i--) {
      const box = textElements[i];
      const handle = getHandle(pos, box);
      if (handle) {
        setActiveElementId(box.id);
        setInteraction({ type: 'resize', handle, startX: pos.x, startY: pos.y, startW: box.width, startH: box.height, originalX: box.x, originalY: box.y });
        return;
      }
      if (pos.x > box.x && pos.x < box.x + box.width && pos.y > box.y && pos.y < box.y + box.height) {
        setActiveElementId(box.id);
        setInteraction({ type: 'drag', startX: pos.x - box.x, startY: pos.y - box.y });
        return;
      }
    }

    setActiveElementId(null);
    setInteraction({ type: null });
  };

  const handleMouseMove = (e) => {
    if (!interaction.type || !activeElementId) return;
    const pos = getMousePos(canvasRef.current, e);
    const element = textElements.find(el => el.id === activeElementId);
    if (!element) return;

    let newProps = {};
    if (interaction.type === 'drag') {
      newProps = { x: pos.x - interaction.startX, y: pos.y - interaction.startY };
    } else if (interaction.type === 'resize') {
      const newWidth = interaction.startW + (pos.x - interaction.startX);
      const newHeight = interaction.startH + (pos.y - interaction.startY);
      newProps = { width: Math.max(newWidth, 50), height: Math.max(newHeight, 20) };
    }

    // --- Snapping Logic ---
    const snapThreshold = 5;
    const activeGuidelines = [];
    let finalProps = { ...newProps };

    const activeBox = { ...element, ...newProps };
    const otherElements = textElements.filter(el => el.id !== activeElementId);
    const canvas = canvasRef.current;

    const activePoints = {
      x: [activeBox.x, activeBox.x + activeBox.width / 2, activeBox.x + activeBox.width],
      y: [activeBox.y, activeBox.y + activeBox.height / 2, activeBox.y + activeBox.height]
    };

    const targetPoints = {
      x: [0, canvas.width / 2, canvas.width],
      y: [0, canvas.height / 2, canvas.height]
    };

    otherElements.forEach(el => {
      targetPoints.x.push(el.x, el.x + el.width / 2, el.x + el.width);
      targetPoints.y.push(el.y, el.y + el.height / 2, el.y + el.height);
    });

    // Snap X
    for (const activeP of activePoints.x) {
      for (const targetP of targetPoints.x) {
        if (Math.abs(activeP - targetP) < snapThreshold) {
          if (interaction.type === 'drag') {
            finalProps.x = targetP - (activeP - activeBox.x);
          } else if (interaction.type === 'resize') {
            finalProps.width = targetP - activeBox.x;
          }
          activeGuidelines.push({ type: 'vertical', x: targetP });
        }
      }
    }

    // Snap Y
    for (const activeP of activePoints.y) {
      for (const targetP of targetPoints.y) {
        if (Math.abs(activeP - targetP) < snapThreshold) {
          if (interaction.type === 'drag') {
            finalProps.y = targetP - (activeP - activeBox.y);
          } else if (interaction.type === 'resize') {
            finalProps.height = targetP - activeBox.y;
          }
          activeGuidelines.push({ type: 'horizontal', y: targetP });
        }
      }
    }
    
    setGuidelines(activeGuidelines);
    updateElement(activeElementId, finalProps);
  };

  const handleMouseUp = () => {
    if(interaction.type) {
      commitChanges();
    }
    setInteraction({ type: null });
    setGuidelines([]);
  };

  // --- Other Functions ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          // Reset history on new image
          const freshState = { textElements: initialTextElements, imageFilters: initialImageFilters };
          setTextElements(freshState.textElements);
          setImageFilters(freshState.imageFilters);
          setHistory([freshState]);
          setHistoryIndex(0);
        }
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = () => {
    const currentActiveId = activeElementId;
    setActiveElementId(null); // Hide bounding box for download
    
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const link = document.createElement('a');
        link.download = 'captioned-image.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
      setActiveElementId(currentActiveId); // Restore active box
    }, 100);
  };
  
  const saveProject = () => {
    const projectData = {
      textElements,
      imageFilters,
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'my-project.json';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const loadProject = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target.result);
          if (projectData.textElements && projectData.imageFilters) {
            setTextElements(projectData.textElements);
            setImageFilters(projectData.imageFilters);
            updateHistory({ 
              textElements: projectData.textElements, 
              imageFilters: projectData.imageFilters 
            });
          }
        } catch (error) {
          console.error("Error loading project file:", error);
          alert("Invalid project file.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFilterChange = (filter, value) => {
    setImageFilters(prev => ({ ...prev, [filter]: value }));
  };

  const resetFilters = () => {
    setImageFilters(initialImageFilters);
    updateHistory({ textElements, imageFilters: initialImageFilters });
  };

  const activeElement = textElements.find(el => el.id === activeElementId);

  // --- JSX ---
  return (
    <div className="container-fluid">
      <div className="row">
        {/* Control Panel */}
        <div className="col-lg-4">
          {/* Main Controls */}
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">Project Controls</h5>
              <div className="mb-3">
                <label htmlFor="imageUpload" className="form-label">1. Upload Image</label>
                <input type="file" className="form-control" id="imageUpload" onChange={handleImageUpload} accept="image/*" />
              </div>
               <div className="d-flex justify-content-between mb-3">
                <button className="btn btn-secondary" onClick={undo} disabled={historyIndex === 0}>Undo</button>
                <button className="btn btn-secondary" onClick={redo} disabled={historyIndex === history.length - 1}>Redo</button>
              </div>
              <div className="d-flex justify-content-between">
                <button className="btn btn-primary" onClick={saveProject}>Save Project</button>
                <label className="btn btn-primary">Load Project<input type="file" hidden onChange={loadProject} accept=".json" /></label>
              </div>
            </div>
          </div>

          {/* Image Filters */}
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title mb-0">Image Filters</h5>
                <button className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>Reset</button>
              </div>
              <div className="row g-3">
                <div className="col-6"><label htmlFor="brightness" className="form-label">Brightness</label><input type="range" className="form-range" id="brightness" min="0" max="200" value={imageFilters.brightness} onChange={e => handleFilterChange('brightness', e.target.value)} onMouseUp={() => commitChanges()} /></div>
                <div className="col-6"><label htmlFor="contrast" className="form-label">Contrast</label><input type="range" className="form-range" id="contrast" min="0" max="200" value={imageFilters.contrast} onChange={e => handleFilterChange('contrast', e.target.value)} onMouseUp={() => commitChanges()} /></div>
                <div className="col-6"><label htmlFor="grayscale" className="form-label">Grayscale</label><input type="range" className="form-range" id="grayscale" min="0" max="100" value={imageFilters.grayscale} onChange={e => handleFilterChange('grayscale', e.target.value)} onMouseUp={() => commitChanges()} /></div>
                <div className="col-6"><label htmlFor="sepia" className="form-label">Sepia</label><input type="range" className="form-range" id="sepia" min="0" max="100" value={imageFilters.sepia} onChange={e => handleFilterChange('sepia', e.target.value)} onMouseUp={() => commitChanges()} /></div>
              </div>
            </div>
          </div>

          {/* Text Controls */}
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">Text Controls</h5>
              <button className="btn btn-primary w-100 mb-3" onClick={addTextElement}>Add New Text</button>
              {activeElement && <button className="btn btn-danger w-100" onClick={deleteActiveElement}>Delete Selected Text</button>}
            </div>
          </div>

          {/* Active Element Settings */}
          {activeElement && (
            <div className="card mb-3 border-primary">
              <div className="card-body">
                <h5 className="card-title">Edit Selected Text</h5>
                <div className="mb-3"><label className="form-label">Text</label><textarea className="form-control" rows="2" value={activeElement.text} onChange={(e) => handleElementChange('text', e.target.value)} onBlur={() => commitChanges()}></textarea></div>
                <div className="row g-3">
                  <div className="col-6"><label className="form-label">Font</label><select className="form-select" value={activeElement.font} onChange={(e) => handleElementChange('font', e.target.value)} onBlur={() => commitChanges()}>{fonts.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div className="col-6"><label className="form-label">Size</label><input type="number" className="form-control" value={activeElement.size} onChange={(e) => handleElementChange('size', Number(e.target.value))} onBlur={() => commitChanges()}/></div>
                  <div className="col-md-12">
                    <label className="form-label">Color</label>
                    <div className="d-flex align-items-center">
                      <input type="color" className="form-control form-control-color" value={activeElement.color} onChange={(e) => handleElementChange('color', e.target.value)} onBlur={() => commitChanges()}/>
                      <span className="ms-2">{activeElement.color}</span>
                    </div>
                  </div>
                  <div className="col-12">
                    {colorPalettes.map(palette => (
                      <div key={palette.name} className="mt-2">
                        <label className="form-label palette-name">{palette.name}</label>
                        <div className="palette-container">
                          {palette.colors.map(color => (
                            <div 
                              key={color}
                              className="color-swatch"
                              style={{ backgroundColor: color }}
                              onClick={() => handleColorSwatchClick(color)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center">
                      <label className="form-label mb-0">Rotation</label>
                      <button className="btn btn-sm btn-outline-secondary" onClick={resetRotation}>Reset</button>
                    </div>
                    <input type="range" className="form-range" min="-180" max="180" value={activeElement.rotation} onChange={(e) => handleRotationChange(Number(e.target.value))} onMouseUp={handleRotationMouseUp}/>
                  </div>
                </div>
                <div className="mt-3"><label className="form-label">Alignment</label><div className="btn-group w-100"><button className={`btn ${activeElement.align === 'left' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => {handleElementChange('align', 'left'); commitChanges();}}>Left</button><button className={`btn ${activeElement.align === 'center' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => {handleElementChange('align', 'center'); commitChanges();}}>Center</button><button className={`btn ${activeElement.align === 'right' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => {handleElementChange('align', 'right'); commitChanges();}}>Right</button></div></div>
                
                {/* Background Settings */}
                <div className="mt-3 p-2 border rounded">
                  <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={activeElement.bgColor.enabled} onChange={(e) => {handleNestedChange('bgColor', 'enabled', e.target.checked); commitChanges();}}/><label className="form-check-label">Background</label></div>
                  {activeElement.bgColor.enabled && (<div className="mt-2"><label className="form-label">BG Color</label><input type="color" className="form-control form-control-color" value={activeElement.bgColor.color} onChange={(e) => handleNestedChange('bgColor', 'color', e.target.value)} onBlur={() => commitChanges()}/></div>)}
                </div>

                {/* Shadow Settings */}
                <div className="mt-3 p-2 border rounded">
                  <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={activeElement.shadow.enabled} onChange={(e) => {handleNestedChange('shadow', 'enabled', e.target.checked); commitChanges();}}/><label className="form-check-label">Shadow</label></div>
                  {activeElement.shadow.enabled && (<div className="mt-2">
                    <div className="row g-3">
                      <div className="col-6"><label className="form-label">Color</label><input type="color" className="form-control form-control-color" value={activeElement.shadow.color} onChange={(e) => handleNestedChange('shadow', 'color', e.target.value)} onBlur={() => commitChanges()}/></div>
                      <div className="col-6"><label className="form-label">Blur</label><input type="range" className="form-range" min="0" max="50" value={activeElement.shadow.blur} onChange={(e) => handleNestedChange('shadow', 'blur', Number(e.target.value))} onMouseUp={() => commitChanges()}/></div>
                      <div className="col-6"><label className="form-label">Offset X</label><input type="range" className="form-range" min="-50" max="50" value={activeElement.shadow.offsetX} onChange={(e) => handleNestedChange('shadow', 'offsetX', Number(e.target.value))} onMouseUp={() => commitChanges()}/></div>
                      <div className="col-6"><label className="form-label">Offset Y</label><input type="range" className="form-range" min="-50" max="50" value={activeElement.shadow.offsetY} onChange={(e) => handleNestedChange('shadow', 'offsetY', Number(e.target.value))} onMouseUp={() => commitChanges()}/></div>
                    </div>
                  </div>)}
                </div>
                
                {/* Stroke Settings */}
                <div className="mt-3 p-2 border rounded">
                  <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={activeElement.stroke.enabled} onChange={(e) => {handleNestedChange('stroke', 'enabled', e.target.checked); commitChanges();}}/><label className="form-check-label">Stroke (Outline)</label></div>
                  {activeElement.stroke.enabled && (<div className="mt-2">
                     <div className="row g-3">
                        <div className="col-6"><label className="form-label">Color</label><input type="color" className="form-control form-control-color" value={activeElement.stroke.color} onChange={(e) => handleNestedChange('stroke', 'color', e.target.value)} onBlur={() => commitChanges()}/></div>
                        <div className="col-6"><label className="form-label">Width</label><input type="range" className="form-range" min="1" max="20" value={activeElement.stroke.width} onChange={(e) => handleNestedChange('stroke', 'width', Number(e.target.value))} onMouseUp={() => commitChanges()}/></div>
                     </div>
                  </div>)}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Preview Area */}
        <div className="col-lg-8">
          <div className="card sticky-top" style={{ top: '1rem' }}>
            <div className="card-body">
              <h5 className="card-title">Preview</h5>
              <div 
                ref={canvasContainerRef}
                className="text-center bg-light" 
                style={{ position: 'relative', border: '2px dashed #ccc', cursor: interaction.type ? 'grabbing' : 'default', overflow: 'hidden' }}
              >
                {image ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    />
                    {guidelines.map((g, i) => {
                      const style = g.type === 'vertical' 
                        ? { left: `${(g.x / canvasRef.current.width) * 100}%`, top: 0, width: '1px', height: '100%' }
                        : { top: `${(g.y / canvasRef.current.height) * 100}%`, left: 0, height: '1px', width: '100%' };
                      return <div key={i} className="guideline" style={style}></div>
                    })}
                  </>
                ) : (
                  <div style={{ minHeight: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <p className="text-muted">Upload an image to start</p>
                  </div>
                )}
              </div>
              <button className="btn btn-success w-100 mt-3" onClick={downloadImage} disabled={!image}>
                Download Final Image
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
