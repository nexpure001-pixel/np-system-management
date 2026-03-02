import React from 'react';

const HotspotMarker = ({ hotspot, isSelected, onClick, onDragStart }) => {
    const { x, y, type, icon } = hotspot;

    // Determine base color based on type
    const getColorClasses = () => {
        switch (type) {
            case 'required': return 'bg-accent shadow-[0_0_10px_rgba(232,69,69,0.5)]';
            case 'caution': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
            case 'info': return 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]';
            default: return 'bg-accent';
        }
    };

    const getRingColor = () => {
        switch (type) {
            case 'required': return 'text-accent';
            case 'caution': return 'text-amber-500';
            case 'info': return 'text-blue-600';
            default: return 'text-accent';
        }
    };

    return (
        <div
            className="absolute w-[26px] h-[26px] cursor-pointer z-20 group"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            onClick={(e) => {
                e.stopPropagation();
                onClick(hotspot.id);
            }}
            onMouseDown={(e) => {
                e.stopPropagation(); // Prevent canvas click
                onDragStart(e, hotspot.id);
            }}
        >
            {/* Ripple Animation rings */}
            <div className={`absolute inset-[-5px] rounded-full border-[2.5px] border-current opacity-90 animate-ripple ${getRingColor()}`}></div>
            <div className={`absolute inset-[-5px] rounded-full border-[2.5px] border-current opacity-90 animate-ripple delay-[0.8s] ${getRingColor()}`}></div>

            {/* Main Dot */}
            <div className={`absolute inset-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white z-[2] transition-transform duration-150 group-hover:scale-110 ${getColorClasses()} ${isSelected ? 'ring-2 ring-white scale-110' : ''}`}>
                {icon === 'dot' ? '●' : icon}
            </div>
        </div>
    );
};

export default HotspotMarker;
