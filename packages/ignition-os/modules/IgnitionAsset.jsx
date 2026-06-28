import React from 'react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';
import AssetManager from '@trace/shared/components/AssetManager';

export default function IgnitionAsset({ onBack }) {
  const shopId = DataBridge.getShopId();
  return (
    <AssetManager 
      supabase={supabase} 
      tableName="tools" 
      businessId={shopId} 
      businessIdColumn="shop_id"
      fieldMap={{
        name: 'name',
        category: 'type',
        brand: 'brand',
        model: 'model',
        serialNumber: 'serial',
        barcodeId: 'barcode_id',
        imageUrl: 'photo_url',
        notes: null
      }}
      defaultInsertValues={{
        status: 'ACTIVE'
      }}
      theme="dark"
      onBack={onBack} 
    />
  );
}
