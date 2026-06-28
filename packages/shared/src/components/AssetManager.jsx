import React, { useState, useEffect } from 'react';
import { 
  Folder, FolderOpen, Image as ImageIcon, Search, LayoutGrid, List, 
  Plus, Download, Archive, BarChart, X, RefreshCw, FileText, 
  ArrowUpDown, ChevronRight, Edit3, Trash2, HelpCircle 
} from 'lucide-react';

const API_PREFIX = '/api/assets';

const THEMES = {
  dark: {
    bg: '#020617',
    headerBg: '#0f172a',
    cardBg: '#0f172a',
    textColor: '#f8fafc',
    secTextColor: '#94a3b8',
    borderColor: '#1e293b',
    accentColor: '#38bdf8',
    accentHover: '#7dd3fc',
    accentText: '#020617',
    inputBg: '#1e293b',
    inputText: '#ffffff',
    inputBorder: '#334155',
    hoverBg: 'rgba(56, 189, 248, 0.15)',
    hoverText: '#38bdf8',
  },
  light: {
    bg: '#EAF3DE',
    headerBg: '#ffffff',
    cardBg: '#ffffff',
    textColor: '#111827',
    secTextColor: '#4b5563',
    borderColor: '#e5e7eb',
    accentColor: '#27500A',
    accentHover: '#1d3d07',
    accentText: '#ffffff',
    inputBg: '#ffffff',
    inputText: '#111827',
    inputBorder: '#d1d5db',
    hoverBg: 'rgba(39, 80, 10, 0.1)',
    hoverText: '#27500A',
  }
};

// Helper to parse numeric filters like "price>100"
const parsePriceFilter = (query) => {
  const match = query.match(/price\s*([><=])\s*(\d+)/i);
  if (match) {
    return { op: match[1], val: parseFloat(match[2]) };
  }
  return null;
};

export default function AssetManager({
  supabase,
  tableName,
  businessId,
  businessIdColumn,
  fieldMap = {},
  filterQuery = null,
  defaultInsertValues = null,
  theme = 'dark',
  onBack = null
}) {
  const activeTheme = THEMES[theme] || THEMES.dark;

  // State
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeFolder, setActiveFolder] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [sortBy, setSortBy] = useState('name'); // name | price | date
  const [sortOrder, setSortOrder] = useState('asc'); // asc | desc

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit / Add Form State
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editBarcodeId, setEditBarcodeId] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUserNotes, setEditUserNotes] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSpecs, setEditSpecs] = useState({});

  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [customFolders, setCustomFolders] = useState([]);

  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  
  // Scanning / AI workflow
  const [scanFile, setScanFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAppraising, setIsAppraising] = useState(false);

  // Load assets from Supabase
  const loadAssets = async () => {
    if (!supabase || !tableName || !businessId || !businessIdColumn) {
      setError("Asset Manager is missing required props (supabase, tableName, businessId, businessIdColumn).");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(tableName).select('*').eq(businessIdColumn, businessId);
      if (filterQuery) {
        query = filterQuery(query);
      }
      
      const { data, error: sbError } = await query;
      if (sbError) throw sbError;

      // Translate database rows to standardized internal representation
      const parsedAssets = (data || []).map(row => {
        let richMeta = {};
        const notesCol = fieldMap.notes !== undefined ? fieldMap.notes : 'notes';
        const rawNotes = notesCol ? (row[notesCol] || '') : '';
        
        if (notesCol && typeof rawNotes === 'string' && rawNotes.trim().startsWith('{')) {
          try {
            richMeta = JSON.parse(rawNotes);
          } catch (e) {
            // Treat as plain text
          }
        }

        const logicalPrice = row[fieldMap.price] !== undefined && row[fieldMap.price] !== null
          ? parseFloat(row[fieldMap.price])
          : (richMeta.price ? parseFloat(richMeta.price) : null);

        const logicalImageUrl = fieldMap.imageUrl && row[fieldMap.imageUrl] !== undefined
          ? row[fieldMap.imageUrl]
          : (richMeta.imageUrl || '');

        return {
          id: row.id,
          name: row[fieldMap.name || 'name'] || '',
          category: row[fieldMap.category || 'category'] || row[fieldMap.category || 'type'] || 'Uncategorized',
          brand: row[fieldMap.brand] || richMeta.brand || '',
          model: row[fieldMap.model] || richMeta.model || '',
          serialNumber: row[fieldMap.serialNumber] || richMeta.serialNumber || '',
          barcodeId: row[fieldMap.barcodeId] || richMeta.barcodeId || '',
          price: logicalPrice,
          imageUrl: logicalImageUrl,
          specs: richMeta.specs || {},
          userNotes: richMeta.userNotes !== undefined 
            ? richMeta.userNotes 
            : (notesCol && typeof rawNotes === 'string' && !rawNotes.trim().startsWith('{') ? rawNotes : ''),
          created_at: row.created_at || new Date().toISOString(),
          rawRow: row
        };
      });

      setAssets(parsedAssets);
    } catch (err) {
      console.error('[AssetManager] Load Error:', err);
      setError(err.message || 'Failed to fetch assets from backend database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [tableName, businessId]);

  // Derived folders list
  const systemFolders = Array.from(new Set(assets.map(a => a.category).filter(Boolean)));
  const allFolders = Array.from(new Set(['All', 'Uncategorized', ...systemFolders, ...customFolders]));

  // Sync edit form with selected asset
  useEffect(() => {
    if (selectedAsset) {
      setEditName(selectedAsset.name);
      setEditCategory(selectedAsset.category);
      setEditBrand(selectedAsset.brand);
      setEditModel(selectedAsset.model);
      setEditSerialNumber(selectedAsset.serialNumber);
      setEditBarcodeId(selectedAsset.barcodeId);
      setEditPrice(selectedAsset.price ? String(selectedAsset.price) : '');
      setEditUserNotes(selectedAsset.userNotes);
      setEditImageUrl(selectedAsset.imageUrl);
      setEditSpecs(selectedAsset.specs);
    } else {
      clearForm();
    }
  }, [selectedAsset]);

  const clearForm = () => {
    setEditName('');
    setEditCategory(activeFolder !== 'All' && activeFolder !== 'Uncategorized' ? activeFolder : 'Tools');
    setEditBrand('');
    setEditModel('');
    setEditSerialNumber('');
    setEditBarcodeId('');
    setEditPrice('');
    setEditUserNotes('');
    setEditImageUrl('');
    setEditSpecs({});
  };

  // Convert form fields to raw DB insert/update row
  const makeDbRow = (logicalAsset, isNew = false) => {
    const richMeta = {
      imageUrl: logicalAsset.imageUrl || '',
      specs: logicalAsset.specs || {},
      price: logicalAsset.price ? parseFloat(logicalAsset.price) : null,
      brand: logicalAsset.brand || '',
      model: logicalAsset.model || '',
      userNotes: logicalAsset.userNotes || '',
    };

    const row = {};
    if (isNew) {
      row[businessIdColumn] = businessId;
      if (defaultInsertValues) {
        Object.assign(row, defaultInsertValues);
      }
    }

    row[fieldMap.name || 'name'] = logicalAsset.name || (logicalAsset.brand && logicalAsset.model ? `${logicalAsset.brand} ${logicalAsset.model}` : 'Unnamed Asset');
    
    if (fieldMap.category !== null) {
      row[fieldMap.category || 'category'] = logicalAsset.category || 'Uncategorized';
    }

    if (fieldMap.brand) row[fieldMap.brand] = logicalAsset.brand || null;
    if (fieldMap.model) row[fieldMap.model] = logicalAsset.model || null;
    if (fieldMap.serialNumber) row[fieldMap.serialNumber] = logicalAsset.serialNumber || null;
    if (fieldMap.barcodeId) row[fieldMap.barcodeId] = logicalAsset.barcodeId || null;
    if (fieldMap.price) row[fieldMap.price] = logicalAsset.price ? parseFloat(logicalAsset.price) : null;
    if (fieldMap.imageUrl) row[fieldMap.imageUrl] = logicalAsset.imageUrl || null;

    if (fieldMap.notes !== null && fieldMap.notes !== undefined) {
      row[fieldMap.notes] = JSON.stringify(richMeta);
    } else if (fieldMap.notes === undefined) {
      row['notes'] = JSON.stringify(richMeta);
    }
    
    return row;
  };

  // Database Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!editName && !editBrand) return;

    setLoading(true);
    try {
      const logicalAsset = {
        name: editName || `${editBrand} ${editModel}`,
        category: editCategory,
        brand: editBrand,
        model: editModel,
        serialNumber: editSerialNumber,
        barcodeId: editBarcodeId,
        price: editPrice ? parseFloat(editPrice) : null,
        imageUrl: editImageUrl,
        specs: editSpecs,
        userNotes: editUserNotes
      };

      const dbRow = makeDbRow(logicalAsset, !selectedAsset);

      if (selectedAsset) {
        // Update
        const { error: sbError } = await supabase
          .from(tableName)
          .update(dbRow)
          .eq('id', selectedAsset.id)
          .eq(businessIdColumn, businessId);

        if (sbError) throw sbError;
      } else {
        // Insert
        const { error: sbError } = await supabase
          .from(tableName)
          .insert(dbRow);

        if (sbError) throw sbError;
      }

      setIsEditing(false);
      setSelectedAsset(null);
      await loadAssets();
    } catch (err) {
      console.error('[AssetManager] Save Error:', err);
      alert('Error saving asset record: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Database Delete
  const handleDelete = async (assetId) => {
    if (!window.confirm("Are you sure you want to delete this asset from the cloud database?")) return;
    setLoading(true);
    try {
      const { error: sbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', assetId)
        .eq(businessIdColumn, businessId);

      if (sbError) throw sbError;

      setSelectedAsset(null);
      await loadAssets();
    } catch (err) {
      console.error('[AssetManager] Delete Error:', err);
      alert('Error deleting asset: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanFile(file);
    setIsScanning(true);

    try {
      // 1. Upload to local server hosting
      const formData = new FormData();
      formData.append('file', file);
      const folderParam = activeFolder !== 'All' && activeFolder !== 'Uncategorized' ? activeFolder : 'Scans';

      const uploadRes = await fetch(`${API_PREFIX}/upload?folder=${encodeURIComponent(folderParam)}`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Local host file upload failed.");
      const uploadData = await uploadRes.json();
      
      const fileUrl = uploadData.url;
      const fileName = uploadData.filename;
      setEditImageUrl(fileUrl);

      // 2. Trigger Gemini Scanner
      const analyzeRes = await fetch(`${API_PREFIX}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileName, folder: folderParam }),
      });

      if (!analyzeRes.ok) throw new Error("Gemini AI Scan model failed.");
      const analyzeData = await analyzeRes.json();

      // Populate Form with AI extracts
      setEditName(analyzeData.name || '');
      setEditBrand(analyzeData.brand || '');
      setEditModel(analyzeData.model || '');
      setEditCategory(analyzeData.device_type || folderParam);
      setEditUserNotes(analyzeData.summary || '');
      
      if (analyzeData.estimated_value) {
        setEditPrice(String(analyzeData.estimated_value));
      }
      if (analyzeData.specifications) {
        setEditSpecs(analyzeData.specifications);
      }

      setIsEditing(true);
    } catch (err) {
      console.error('[AssetManager] Scan Error:', err);
      alert("AI Scan Error: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Live Price Web Appraisal
  const handleLiveAppraisal = async () => {
    if (!editBrand && !editModel) {
      alert("Please specify a Brand and Model first for live pricing lookup.");
      return;
    }
    setIsAppraising(true);
    try {
      const res = await fetch(`${API_PREFIX}/fetch_price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: editBrand, model: editModel }),
      });

      if (!res.ok) throw new Error("Web search valuation engine returned an error.");
      const data = await res.json();
      
      if (data.price) {
        setEditPrice(String(data.price));
      }
      if (data.source) {
        setEditUserNotes(prev => prev + `\n\n[Appraisal Lookup: ${data.source}]`);
      }
      alert(`Valuation completed! Found price: $${data.price}`);
    } catch (err) {
      console.error('[AssetManager] Appraisal Error:', err);
      alert("Valuation failed: " + err.message);
    } finally {
      setIsAppraising(false);
    }
  };

  // Local Zip Backup Trigger
  const handleBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_PREFIX}/backup`, { method: 'POST' });
      if (!res.ok) throw new Error("Server zip engine failed.");
      const data = await res.json();
      alert(`Local backup archive successfully created!\nPath: ${data.backup_zip}`);
    } catch (err) {
      console.error('[AssetManager] Backup Error:', err);
      alert("Backup failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Local CSV Export (Browser-Generated for Cloud Independence)
  const handleExportCSV = () => {
    if (assets.length === 0) {
      alert("No asset records found to export.");
      return;
    }
    const headers = ['ID', 'Name', 'Category', 'Brand', 'Model', 'Serial Number', 'Barcode ID', 'Valuation', 'Date Added'];
    const rows = assets.map(a => [
      a.id,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${a.category.replace(/"/g, '""')}"`,
      `"${a.brand.replace(/"/g, '""')}"`,
      `"${a.model.replace(/"/g, '""')}"`,
      `"${a.serialNumber.replace(/"/g, '""')}"`,
      `"${a.barcodeId.replace(/"/g, '""')}"`,
      a.price || '',
      a.created_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trace_assets_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add Folder logic
  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    setCustomFolders(prev => [...prev, newFolderName.trim()]);
    setActiveFolder(newFolderName.trim());
    setNewFolderName('');
    setShowFolderModal(false);
  };

  // Analytics helper calculations
  const totalValuation = assets.reduce((sum, a) => sum + (a.price || 0), 0);
  const totalItems = assets.length;
  const brandCount = Array.from(new Set(assets.map(a => a.brand).filter(Boolean))).length;

  // Filter & Sort Logic
  const priceFilter = parsePriceFilter(searchQuery);
  const filteredAssets = assets.filter(asset => {
    // 1. Folder check
    if (activeFolder !== 'All') {
      if (activeFolder === 'Uncategorized') {
        if (asset.category && asset.category !== 'Uncategorized' && asset.category !== 'Tools') return false;
      } else if (asset.category !== activeFolder) {
        return false;
      }
    }

    // 2. Numeric / price filter check (e.g. price>100)
    if (priceFilter) {
      const assetPrice = asset.price || 0;
      if (priceFilter.op === '>') return assetPrice > priceFilter.val;
      if (priceFilter.op === '<') return assetPrice < priceFilter.val;
      if (priceFilter.op === '=') return assetPrice === priceFilter.val;
    }

    // 3. Simple text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        asset.name.toLowerCase().includes(q) ||
        asset.brand.toLowerCase().includes(q) ||
        asset.model.toLowerCase().includes(q) ||
        asset.category.toLowerCase().includes(q) ||
        asset.serialNumber.toLowerCase().includes(q) ||
        asset.userNotes.toLowerCase().includes(q)
      );
    }

    return true;
  });

  // Sorting
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    let fieldA, fieldB;
    if (sortBy === 'price') {
      fieldA = a.price || 0;
      fieldB = b.price || 0;
    } else if (sortBy === 'date') {
      fieldA = a.created_at;
      fieldB = b.created_at;
    } else {
      fieldA = a.name.toLowerCase();
      fieldB = b.name.toLowerCase();
    }

    if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      backgroundColor: activeTheme.bg,
      color: activeTheme.textColor,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* HEADER NAVBAR */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        backgroundColor: activeTheme.headerBg,
        borderBottom: `1px solid ${activeTheme.borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button 
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: activeTheme.accentColor,
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              ←
            </button>
          )}
          <h1 style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            fontStyle: 'italic',
            textTransform: 'uppercase',
            letterSpacing: '-0.03em',
            color: activeTheme.accentColor,
            margin: 0,
          }}>
            Asset Media Library ({theme.toUpperCase()})
          </h1>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: `1px solid ${activeTheme.borderColor}`,
            backgroundColor: activeTheme.accentColor,
            color: activeTheme.accentText,
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}>
            <ImageIcon size={16} />
            {isScanning ? 'Scanning...' : 'Import Scan'}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
              disabled={isScanning}
            />
          </label>

          <button 
            onClick={() => { setSelectedAsset(null); setIsEditing(true); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${activeTheme.borderColor}`,
              backgroundColor: activeTheme.cardBg,
              color: activeTheme.textColor,
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} /> New Asset
          </button>

          <button 
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${activeTheme.borderColor}`,
              backgroundColor: activeTheme.cardBg,
              color: activeTheme.textColor,
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            <Download size={16} /> CSV
          </button>

          <button 
            onClick={handleBackup}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${activeTheme.borderColor}`,
              backgroundColor: activeTheme.cardBg,
              color: activeTheme.textColor,
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            <Archive size={16} /> Backup
          </button>

          <button 
            onClick={() => setShowAnalyticsModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${activeTheme.borderColor}`,
              backgroundColor: activeTheme.cardBg,
              color: activeTheme.textColor,
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            <BarChart size={16} /> Stats
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT LAYOUT */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* SIDEBAR FOR FOLDERS */}
        <aside style={{
          width: '260px',
          backgroundColor: activeTheme.headerBg,
          borderRight: `1px solid ${activeTheme.borderColor}`,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor, margin: 0 }}>Categories</h3>
            <button 
              onClick={() => setShowFolderModal(true)}
              style={{ background: 'none', border: 'none', color: activeTheme.accentColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              + Add
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {allFolders.map(folder => {
              const count = folder === 'All' 
                ? assets.length 
                : folder === 'Uncategorized' 
                  ? assets.filter(a => !a.category || a.category === 'Uncategorized' || a.category === 'Tools').length
                  : assets.filter(a => a.category === folder).length;

              const isActive = activeFolder === folder;
              return (
                <div 
                  key={folder}
                  onClick={() => setActiveFolder(folder)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: isActive ? 'bold' : 'normal',
                    backgroundColor: isActive ? activeTheme.hoverBg : 'transparent',
                    color: isActive ? activeTheme.hoverText : activeTheme.textColor,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isActive ? <FolderOpen size={16} /> : <Folder size={16} />}
                    <span>{folder}</span>
                  </div>
                  <span style={{ fontSize: '11px', opacity: 0.6 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* MIDDLE CONTENT CONTAINER */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* SEARCH & FILTER BAR */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              backgroundColor: activeTheme.cardBg,
              border: `1px solid ${activeTheme.borderColor}`,
              borderRadius: '8px',
              padding: '6px 12px',
              gap: '8px',
            }}>
              <Search size={16} style={{ color: activeTheme.secTextColor }} />
              <input 
                type="text" 
                placeholder="Search specs, brand, model or price (e.g. price>200)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTheme.textColor,
                  outline: 'none',
                  width: '100%',
                  fontSize: '13px',
                }}
              />
              {searchQuery && <X size={16} onClick={() => setSearchQuery('')} style={{ cursor: 'pointer', opacity: 0.5 }} />}
            </div>

            {/* Sort & Layout Controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)}
                style={{
                  backgroundColor: activeTheme.cardBg,
                  border: `1px solid ${activeTheme.borderColor}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: activeTheme.textColor,
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="name">Sort by Name</option>
                <option value="price">Sort by Price</option>
                <option value="date">Sort by Date</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                style={{
                  backgroundColor: activeTheme.cardBg,
                  border: `1px solid ${activeTheme.borderColor}`,
                  borderRadius: '8px',
                  padding: '8px',
                  color: activeTheme.textColor,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ArrowUpDown size={16} />
              </button>

              <div style={{
                display: 'flex',
                border: `1px solid ${activeTheme.borderColor}`,
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <button 
                  onClick={() => setViewMode('grid')}
                  style={{
                    backgroundColor: viewMode === 'grid' ? activeTheme.accentColor : activeTheme.cardBg,
                    color: viewMode === 'grid' ? activeTheme.accentText : activeTheme.textColor,
                    border: 'none',
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <LayoutGrid size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{
                    backgroundColor: viewMode === 'list' ? activeTheme.accentColor : activeTheme.cardBg,
                    color: viewMode === 'list' ? activeTheme.accentText : activeTheme.textColor,
                    border: 'none',
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* MAIN GRID/LIST OF ITEMS */}
          {loading ? (
            <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <RefreshCw size={24} className="animate-spin" />
              <span style={{ marginLeft: '12px', fontSize: '14px' }}>Loading assets...</span>
            </div>
          ) : sortedAssets.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              border: `2px dashed ${activeTheme.borderColor}`,
              borderRadius: '16px',
            }}>
              <HelpCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px' }}>No Asset Records Found</h4>
              <p style={{ fontSize: '13px', color: activeTheme.secTextColor, margin: 0 }}>
                Import an image to scan it using AI, or click "New Asset" to write directly to Supabase.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px',
            }}>
              {sortedAssets.map(asset => (
                <div 
                  key={asset.id}
                  onClick={() => { setSelectedAsset(asset); setIsEditing(false); }}
                  style={{
                    backgroundColor: activeTheme.cardBg,
                    border: selectedAsset?.id === asset.id ? `2px solid ${activeTheme.accentColor}` : `1px solid ${activeTheme.borderColor}`,
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                >
                  {/* Photo Container */}
                  <div style={{
                    width: '100%',
                    height: '140px',
                    backgroundColor: theme === 'dark' ? '#020617' : '#f3f4f6',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    marginBottom: '12px',
                    border: `1px solid ${activeTheme.borderColor}`
                  }}>
                    {asset.imageUrl ? (
                      <img 
                        src={asset.imageUrl} 
                        alt={asset.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <ImageIcon size={32} style={{ opacity: 0.2, color: activeTheme.textColor }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: activeTheme.accentColor, fontWeight: 'bold', marginBottom: '4px' }}>
                      {asset.category}
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 6px', color: activeTheme.textColor }}>
                      {asset.name || `${asset.brand} ${asset.model}` || 'Unnamed Item'}
                    </h4>
                    {asset.brand && (
                      <div style={{ fontSize: '12px', color: activeTheme.secTextColor, marginBottom: '2px' }}>
                        {asset.brand} · {asset.model}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: activeTheme.textColor }}>
                        {asset.price ? `$${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </span>
                      <ChevronRight size={16} style={{ color: activeTheme.secTextColor }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* LIST VIEW */
            <div style={{
              backgroundColor: activeTheme.cardBg,
              border: `1px solid ${activeTheme.borderColor}`,
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: `2px solid ${activeTheme.borderColor}`, color: activeTheme.secTextColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Preview</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: `2px solid ${activeTheme.borderColor}`, color: activeTheme.secTextColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Name / Details</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: `2px solid ${activeTheme.borderColor}`, color: activeTheme.secTextColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: `2px solid ${activeTheme.borderColor}`, color: activeTheme.secTextColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Serial Number</th>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: `2px solid ${activeTheme.borderColor}`, color: activeTheme.secTextColor, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAssets.map(asset => (
                    <tr 
                      key={asset.id}
                      onClick={() => { setSelectedAsset(asset); setIsEditing(false); }}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedAsset?.id === asset.id ? activeTheme.hoverBg : 'transparent',
                        borderBottom: `1px solid ${activeTheme.borderColor}`,
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: theme === 'dark' ? '#020617' : '#f3f4f6', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {asset.imageUrl ? (
                            <img src={asset.imageUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <ImageIcon size={18} style={{ opacity: 0.3 }} />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: activeTheme.textColor }}>{asset.name}</div>
                        {asset.brand && <div style={{ fontSize: '11px', color: activeTheme.secTextColor }}>{asset.brand} · {asset.model}</div>}
                      </td>
                      <td style={{ padding: '12px', color: activeTheme.textColor }}>{asset.category}</td>
                      <td style={{ padding: '12px', color: activeTheme.textColor }}>{asset.serialNumber || '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: activeTheme.textColor }}>
                        {asset.price ? `$${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT SIDE DETAILS AND WORKFLOW PANEL */}
        <aside style={{
          width: '380px',
          backgroundColor: activeTheme.headerBg,
          borderLeft: `1px solid ${activeTheme.borderColor}`,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {selectedAsset || isEditing ? (
            <>
              {/* Image Preview / Scan Window */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '180px',
                borderRadius: '12px',
                backgroundColor: theme === 'dark' ? '#020617' : '#f3f4f6',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                border: `1px solid ${activeTheme.borderColor}`
              }}>
                {editImageUrl ? (
                  <img src={editImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', opacity: 0.4 }}>
                    <ImageIcon size={40} style={{ margin: '0 auto 8px' }} />
                    <span style={{ fontSize: '12px' }}>No Image Imported</span>
                  </div>
                )}

                {/* Overlaid edit image input */}
                <label style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  border: '1px solid #334155'
                }}>
                  Change Photo
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {/* Title section with Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: activeTheme.textColor, margin: 0 }}>
                  {selectedAsset ? 'Asset Information' : 'Scan Specifications'}
                </h3>
                {selectedAsset && !isEditing && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setIsEditing(true)}
                      style={{ background: 'none', border: 'none', color: activeTheme.accentColor, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedAsset.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* EDIT FORM */}
              {isEditing ? (
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Asset Name</label>
                    <input 
                      type="text"
                      required
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="e.g. John Deere Tractor 1025R"
                      style={{
                        backgroundColor: activeTheme.inputBg,
                        border: `1px solid ${activeTheme.inputBorder}`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: activeTheme.inputText,
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Category / Folder</label>
                    <select 
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      style={{
                        backgroundColor: activeTheme.inputBg,
                        border: `1px solid ${activeTheme.inputBorder}`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: activeTheme.inputText,
                        fontSize: '13px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {allFolders.filter(f => f !== 'All').map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Brand</label>
                      <input 
                        type="text"
                        value={editBrand}
                        onChange={e => setEditBrand(e.target.value)}
                        placeholder="Brand"
                        style={{
                          backgroundColor: activeTheme.inputBg,
                          border: `1px solid ${activeTheme.inputBorder}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: activeTheme.inputText,
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Model</label>
                      <input 
                        type="text"
                        value={editModel}
                        onChange={e => setEditModel(e.target.value)}
                        placeholder="Model"
                        style={{
                          backgroundColor: activeTheme.inputBg,
                          border: `1px solid ${activeTheme.inputBorder}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: activeTheme.inputText,
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Serial #</label>
                      <input 
                        type="text"
                        value={editSerialNumber}
                        onChange={e => setEditSerialNumber(e.target.value)}
                        placeholder="Optional"
                        style={{
                          backgroundColor: activeTheme.inputBg,
                          border: `1px solid ${activeTheme.inputBorder}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: activeTheme.inputText,
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Barcode ID</label>
                      <input 
                        type="text"
                        value={editBarcodeId}
                        onChange={e => setEditBarcodeId(e.target.value)}
                        placeholder="Optional"
                        style={{
                          backgroundColor: activeTheme.inputBg,
                          border: `1px solid ${activeTheme.inputBorder}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: activeTheme.inputText,
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Valuation (USD)</label>
                      <button 
                        type="button" 
                        onClick={handleLiveAppraisal}
                        disabled={isAppraising}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: activeTheme.accentColor,
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        {isAppraising ? 'Searching...' : '⚡ Web Appraiser'}
                      </button>
                    </div>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      style={{
                        backgroundColor: activeTheme.inputBg,
                        border: `1px solid ${activeTheme.inputBorder}`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: activeTheme.inputText,
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.secTextColor }}>Notes</label>
                    <textarea 
                      rows={3}
                      value={editUserNotes}
                      onChange={e => setEditUserNotes(e.target.value)}
                      placeholder="Condition, location, notes..."
                      style={{
                        backgroundColor: activeTheme.inputBg,
                        border: `1px solid ${activeTheme.inputBorder}`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: activeTheme.inputText,
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button 
                      type="submit"
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: activeTheme.accentColor,
                        color: activeTheme.accentText,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Save to Supabase
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${activeTheme.borderColor}`,
                        backgroundColor: activeTheme.cardBg,
                        color: activeTheme.textColor,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                /* READ ONLY PREVIEW */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: activeTheme.accentColor }}>{selectedAsset.category}</span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: activeTheme.textColor }}>
                      {selectedAsset.price ? `$${selectedAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>

                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px', color: activeTheme.textColor }}>{selectedAsset.name}</h2>
                    {selectedAsset.brand && <div style={{ fontSize: '13px', color: activeTheme.secTextColor }}>Brand: {selectedAsset.brand} · Model: {selectedAsset.model}</div>}
                  </div>

                  {selectedAsset.serialNumber && <div style={{ fontSize: '12px', color: activeTheme.textColor }}><strong>Serial Number:</strong> {selectedAsset.serialNumber}</div>}
                  {selectedAsset.barcodeId && <div style={{ fontSize: '12px', color: activeTheme.textColor }}><strong>Barcode ID:</strong> {selectedAsset.barcodeId}</div>}
                  
                  {selectedAsset.userNotes && (
                    <div style={{ backgroundColor: theme === 'dark' ? '#020617' : '#f3f4f6', padding: '12px', borderRadius: '8px', border: `1px solid ${activeTheme.borderColor}` }}>
                      <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: activeTheme.secTextColor, margin: '0 0 6px' }}>Notes</h4>
                      <p style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap', color: activeTheme.textColor }}>{selectedAsset.userNotes}</p>
                    </div>
                  )}

                  {/* AI Extracted Specs list */}
                  {selectedAsset.specs && Object.keys(selectedAsset.specs).length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: activeTheme.secTextColor, margin: '0 0 8px' }}>AI Specs Parameters</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {Object.entries(selectedAsset.specs).map(([key, val]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${activeTheme.borderColor}`, paddingBottom: '4px', fontSize: '12px' }}>
                            <span style={{ color: activeTheme.secTextColor }}>{key}</span>
                            <span style={{ fontWeight: 'bold', color: activeTheme.textColor }}>{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* NO ITEM SELECTED FALLBACK */
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.4, textAlign: 'center', padding: '24px' }}>
              <FileText size={32} style={{ marginBottom: '12px' }} />
              <span style={{ fontSize: '13px' }}>Select an asset to view details.</span>
            </div>
          )}
        </aside>
      </div>

      {/* CREATE FOLDER MODAL */}
      {showFolderModal && (
        <div style={modalOverlayStyle}>
          <div style={{
            ...modalStyle,
            backgroundColor: activeTheme.cardBg,
            borderColor: activeTheme.borderColor,
            color: activeTheme.textColor
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Add New Category</h3>
            <input 
              type="text" 
              placeholder="Category Name" 
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              style={{
                backgroundColor: activeTheme.inputBg,
                border: `1px solid ${activeTheme.inputBorder}`,
                borderRadius: '8px',
                padding: '8px 12px',
                color: activeTheme.inputText,
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleAddFolder}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTheme.accentColor,
                  color: activeTheme.accentText,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Create
              </button>
              <button 
                onClick={() => { setShowFolderModal(false); setNewFolderName(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${activeTheme.borderColor}`,
                  backgroundColor: 'transparent',
                  color: activeTheme.textColor,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS MODAL */}
      {showAnalyticsModal && (
        <div style={modalOverlayStyle}>
          <div style={{
            ...modalStyle,
            width: '500px',
            backgroundColor: activeTheme.cardBg,
            borderColor: activeTheme.borderColor,
            color: activeTheme.textColor
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Valuation Analytics</h3>
              <X size={20} onClick={() => setShowAnalyticsModal(false)} style={{ cursor: 'pointer' }} />
            </div>

            {/* Analytics Specs Blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{
                backgroundColor: theme === 'dark' ? '#020617' : '#f3f4f6',
                padding: '16px',
                borderRadius: '12px',
                textAlign: 'center',
                border: `1px solid ${activeTheme.borderColor}`
              }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: activeTheme.secTextColor, fontWeight: 'bold' }}>Total Valuation</div>
                <div style={{ fontSize: '24px', fontWeight: 900, margin: '8px 0 0', color: activeTheme.accentColor }}>
                  ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateRows: '1fr 1fr',
                gap: '8px'
              }}>
                <div style={{
                  backgroundColor: theme === 'dark' ? '#020617' : '#f3f4f6',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: `1px solid ${activeTheme.borderColor}`
                }}>
                  <span style={{ fontSize: '12px', color: activeTheme.secTextColor }}>Scanned Inventory</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{totalItems} items</span>
                </div>
                <div style={{
                  backgroundColor: theme === 'dark' ? '#020617' : '#f3f4f6',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: `1px solid ${activeTheme.borderColor}`
                }}>
                  <span style={{ fontSize: '12px', color: activeTheme.secTextColor }}>Catalog Brands</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{brandCount} brands</span>
                </div>
              </div>
            </div>

            {/* Category breakdown listing */}
            <div>
              <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: activeTheme.secTextColor, margin: '0 0 10px', fontWeight: 'bold' }}>Category Breakdowns</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {allFolders.filter(f => f !== 'All').map(folder => {
                  const itemsInFolder = assets.filter(a => folder === 'Uncategorized' 
                    ? !a.category || a.category === 'Uncategorized' || a.category === 'Tools'
                    : a.category === folder
                  );
                  if (itemsInFolder.length === 0) return null;
                  const value = itemsInFolder.reduce((sum, a) => sum + (a.price || 0), 0);
                  const percentage = totalValuation > 0 ? Math.round((value / totalValuation) * 100) : 0;

                  return (
                    <div key={folder} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span><strong>{folder}</strong> ({itemsInFolder.length} items)</span>
                        <span>${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({percentage}%)</span>
                      </div>
                      {/* Custom bar indicator */}
                      <div style={{ width: '100%', height: '6px', backgroundColor: theme === 'dark' ? '#1e293b' : '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: activeTheme.accentColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={() => setShowAnalyticsModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTheme.accentColor,
                color: activeTheme.accentText,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '13px',
                marginTop: '8px'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
