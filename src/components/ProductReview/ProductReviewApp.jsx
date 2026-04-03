import React from 'react';

const ProductReviewApp = () => {
    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            <iframe
                src="/product-review-app/index.html"
                title="商品審査アプリ"
                style={{ width: '100%', height: '100%', border: 'none' }}
            />
        </div>
    );
};

export default ProductReviewApp;
