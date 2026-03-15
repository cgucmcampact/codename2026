import React from 'react';
import type { Card } from '../types';
import styles from './PixelCard.module.css';

interface PixelCardProps {
    card: Card;
    onClick?: () => void;
    selected?: boolean;
    quantity?: number;
    isValidTarget?: boolean;
}

export const PixelCard: React.FC<PixelCardProps> = ({ card, onClick, selected, quantity, isValidTarget }) => {
    return (
        <div
            onClick={onClick}
            className={`${styles.card} ${selected ? styles.selected : ''} ${isValidTarget ? styles.validTarget : ''}`}
        >
            <div className={styles.header}>
                {card.name}
            </div>

            <div className={styles.imagePlaceholder}>
                <span>⚔️</span>
            </div>

            <div className={styles.stats}>
                <div className={styles.row}><span>ATK</span><span>{card.stats.atk}</span></div>
                <div className={styles.row}><span>DEF</span><span>{card.stats.defense}</span></div>
                <div className={styles.row}><span>SPD</span><span>{card.stats.speed}</span></div>
            </div>

            {card.unique && (
                <div className={styles.uniqueBadge}>
                    UNIQUE
                </div>
            )}

            {quantity !== undefined && quantity > 1 && (
                <div className={styles.quantityBadge}>
                    x{quantity}
                </div>
            )}
        </div>
    );
};
