import React from 'react';
import type { Card } from '../types';
import styles from './PixelSlot.module.css';

interface PixelSlotProps {
    slotName: string;
    equippedCard: Card | null;
    onClick: () => void;
    onUnequip?: (e: React.MouseEvent) => void;
    isSelected?: boolean;
}

export const PixelSlot: React.FC<PixelSlotProps> = ({ slotName, equippedCard, onClick, onUnequip, isSelected }) => {
    return (
        <div
            className={`${styles.slot} ${equippedCard ? styles.equipped : ''} ${isSelected ? styles.selected : ''}`}
            onClick={onClick}
            style={isSelected ? { borderColor: '#ffd700', boxShadow: '0 0 10px #ffd700' } : undefined}
        >
            {equippedCard ? (
                <>
                    <div className={styles.icon}>⚔️</div>
                    <div className={styles.label}>{equippedCard.name}</div>
                    {onUnequip && (
                        <div
                            className={styles.removeBtn}
                            onClick={(e) => { e.stopPropagation(); onUnequip(e); }}
                        >
                            x
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className={styles.icon} style={{ opacity: 0.3 }}>🛡️</div>
                    <div className={styles.label}>{slotName}</div>
                </>
            )}
        </div>
    );
};
