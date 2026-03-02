import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import HotspotMarker from './HotspotMarker';
import LinkMarker from './LinkMarker'; // Import LinkMarker

const EditorCanvas = ({
    imageSrc,
    onImageUpload,
    hotspots,
    selectedHotspotId,
    onAddHotspot,
    onSelectHotspot,
    onUpdateHotspotPosition,
    isPreviewMode,
    links = [],
    onSelectLink,
    selectedLinkId,
    onUpdateLinkPosition
}) => {
    const containerRef = useRef(null);
    const [draggingId, setDraggingId] = useState(null);
    const [draggingType, setDraggingType] = useState(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => onImageUpload(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleCanvasClick = (e) => {
        if (isPreviewMode || !imageSrc) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        onAddHotspot({ x, y });
    };

    const handleDragStart = (e, id, type = 'hotspot') => {
        e.stopPropagation();
        if (isPreviewMode) return;
        setDraggingId(id);
        setDraggingType(type);
        if (type === 'hotspot') {
            onSelectHotspot(id);
        } else {
            onSelectLink(id);
        }
    };

    const handleMouseMove = (e) => {
        if (!draggingId || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        // Clamp values between 0 and 100
        const rawX = ((e.clientX - rect.left) / rect.width) * 100;
        const rawY = ((e.clientY - rect.top) / rect.height) * 100;

        const x = Math.max(0, Math.min(100, rawX));
        const y = Math.max(0, Math.min(100, rawY));

        if (draggingType === 'hotspot') {
            onUpdateHotspotPosition(draggingId, { x, y });
        } else if (draggingType === 'link') {
            onUpdateLinkPosition(draggingId, { x, y });
        }
    };

    const handleMouseUp = () => {
        setDraggingId(null);
        setDraggingType(null);
    };

    if (!imageSrc) {
        return (
            <div className="flex-1 flex items-center justify-center m-8 rounded-xl border-2 border-dashed border-white/40 bg-white/20 backdrop-blur-sm">
                <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">スクリーンショットが選択されていません</h3>
                    <p className="mt-1 text-sm text-slate-500">画像をアップロードして開始してください</p>
                    <div className="mt-6">
                        <label className="cursor-pointer rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                            画像を選択
                            <input type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                        </label>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex-1 overflow-auto p-8 flex items-start justify-center"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                ref={containerRef}
                className="relative inline-block shadow-2xl rounded-lg cursor-crosshair max-w-full"
                onClick={handleCanvasClick}
            >
                <img
                    src={imageSrc}
                    alt="Manual Screen"
                    className="block max-w-full h-auto rounded-lg select-none pointer-events-none"
                    style={{ maxHeight: 'calc(100vh - 100px)' }}
                />

                {hotspots.map(hotspot => (
                    <HotspotMarker
                        key={hotspot.id}
                        hotspot={hotspot}
                        isSelected={hotspot.id === selectedHotspotId}
                        onClick={onSelectHotspot}
                        onDragStart={handleDragStart}
                    />
                ))}

                {links.map(link => (
                    <LinkMarker
                        key={link.id}
                        link={link}
                        isSelected={link.id === selectedLinkId}
                        onClick={onSelectLink}
                        onDragStart={handleDragStart}
                    />
                ))}

                {/* Placeholder for tooltips in preview mode - to be implemented */}
            </div>
        </div>
    );
};

export default EditorCanvas;
