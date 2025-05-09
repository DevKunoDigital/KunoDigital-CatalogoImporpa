import React from 'react';

const ImageHandler = ({ src, alt }) => {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '300px', // Tamaño fijo del contenedor
                height: '300px', // Tamaño fijo del contenedor
                overflow: 'hidden',
                borderRadius: '8px', // Bordes redondeados
                backgroundColor: '#f5f5f5', // Fondo gris claro
            }}
        >
            <img
                src={src}
                alt={alt}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain', // Ajusta la imagen sin deformarla
                }}
                onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/300x300?text=No+Image';
                }}
            />
        </div>
    );
};

export default ImageHandler;