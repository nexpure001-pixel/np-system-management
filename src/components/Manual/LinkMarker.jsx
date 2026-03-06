import React from 'react';
import { Link } from 'lucide-react';

const LinkMarker = ({ link, isSelected, onClick, onDragStart, isPreviewMode }) => {
    return (
        <div
            className={`absolute group z-20 ${isSelected ? 'z-30' : ''} ${isPreviewMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
            style={{
                left: `${link.x}%`,
                top: `${link.y}%`,
                transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (isPreviewMode) {
                    if (link.url && link.url !== '#') {
                        let targetUrl = link.url;
                        // For relative internal manual links, prepend /manual/ if not already present
                        if (!targetUrl.startsWith('http') && !targetUrl.startsWith('/') && targetUrl.endsWith('.html')) {
                            targetUrl = `/manual/${targetUrl}`;
                        }
                        window.open(targetUrl, '_blank');
                    }
                } else {
                    onClick(link.id);
                }
            }}
            onMouseDown={(e) => onDragStart(e, link.id, 'link')}
        >
            {/* Link Icon Circle */}
            <div
                className={`flex items-center justify-center w-8 h-8 rounded-full shadow-lg transition-all border-2
        ${isSelected
                        ? 'bg-indigo-600 text-white border-white scale-125 shadow-indigo-500/50'
                        : 'bg-white text-indigo-600 border-indigo-100 hover:scale-110 hover:border-indigo-300'
                    }`}
            >
                <Link size={16} />
            </div>

            {/* Ripple effect for selection */}
            {isSelected && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-indigo-400"></div>
            )}

            {/* Hover Label (Tooltip) */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-40">
                {link.label || 'Link'}
                {/* Little arrow */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
        </div>
    );
};

export default LinkMarker;
