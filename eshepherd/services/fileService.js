// File service for fetching and managing files
const FILES_API_URL = 'https://eshepherd-auth-and-retrieve-files-g7egpip7ea-as.a.run.app';

export const fileService = {
  /**
   * Fetch directory tree from API
   */
  async fetchDirectoryTree(user) {
    if (!user) return null;
    
    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch(FILES_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        return { items: data.items, error: null };
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching directory tree:', error);
      return { items: null, error: 'Failed to load images: ' + error.message };
    }
  },

  /**
   * Refresh URLs from API
   */
  async refreshUrls(user) {
    if (!user) return false;
    
    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch(FILES_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        return { items: data.items, error: null };
      } else {
        throw new Error(data.error || 'Failed to refresh URLs');
      }
    } catch (error) {
      console.error('Error refreshing URLs:', error);
      return { items: null, error: error.message };
    }
  },

  /**
   * Check if URL is expired
   */
  isUrlExpired(file) {
    if (!file || !file.expiry_unix) return false;
    // Compare expiry_unix (seconds) with current time (seconds)
    const currentTime = Math.floor(Date.now() / 1000);
    return file.expiry_unix <= currentTime;
  },

  /**
   * Transform flat file list to tree structure
   */
  transformToTree(data) {
    const tree = {};
    data.forEach(item => {
      const parts = item.name.split('/');
      let current = tree;
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            children: {},
            type: index === parts.length - 1 ? item.type : 'directory',
            url: item.url,
            expiry_timestamp: item.expiry_timestamp,
            expiry_unix: item.expiry_unix,
            model_url: item.model_url,
            model: null // Will be fetched from model_url when needed
          };
        }
        current = current[part].children;
      });
    });
    const convertToArray = (node, isRootLevel = false) => {
      const children = Object.values(node).map(child => {
        return {
          ...child,
          children: convertToArray(child.children)
        };
      });
      
      // Sort directories first, then files
      return children.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        
        // For directories, sort by name in descending order (latest first)
        if (a.type === 'directory' && b.type === 'directory') {
          return b.name.localeCompare(a.name);
        }
        
        // For files, sort alphabetically
        return a.name.localeCompare(b.name);
      });
    };
    return convertToArray(tree, true);
  },

  /**
   * Update URLs in tree structure
   */
  updateUrlsInTree(tree, items, currentFolderFiles = null) {
    // Create a map of item names to their new URLs and expiry info
    const urlMap = {};
    items.forEach(item => {
      urlMap[item.name] = {
        url: item.url,
        expiry_timestamp: item.expiry_timestamp,
        expiry_unix: item.expiry_unix,
        model_url: item.model_url
      };
    });
    
    // Recursively update URLs in the tree
    const updateNode = (node) => {
      if (node.type === 'file' && urlMap[node.name]) {
        const newData = urlMap[node.name];
        node.url = newData.url;
        node.expiry_timestamp = newData.expiry_timestamp;
        node.expiry_unix = newData.expiry_unix;
        node.model_url = newData.model_url;
        // Clear cached model when URL changes
        node.model = null;
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => updateNode(child));
      }
    };
    
    tree.forEach(node => updateNode(node));
    
    // Also update currentFolderFiles if provided
    if (currentFolderFiles && currentFolderFiles.length > 0) {
      currentFolderFiles.forEach(file => {
        if (file.type === 'file' && urlMap[file.name]) {
          const newData = urlMap[file.name];
          file.url = newData.url;
          file.expiry_timestamp = newData.expiry_timestamp;
          file.expiry_unix = newData.expiry_unix;
          file.model_url = newData.model_url;
          // Clear cached model when URL changes
          file.model = null;
        }
      });
    }
    
    return tree;
  },

  /**
   * Find file by name in tree
   */
  findFileByName(nodes, fileName) {
    const search = (nodeList) => {
      for (const node of nodeList) {
        if (node.type === 'file' && node.name === fileName) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(nodes);
  },

  /**
   * Get all files from a node recursively
   */
  getAllFilesFromNode(node) {
    const files = [];
    const collect = (n) => {
      if (n.type === 'file') {
        files.push(n);
      } else if (n.children && n.children.length > 0) {
        n.children.forEach(child => {
          collect(child);
        });
      }
    };
    collect(node);
    return files;
  },

  /**
   * Ensure URL is valid, refresh if expired
   */
  async ensureUrlValid(file, user, directoryTree, refreshUrlsCallback) {
    if (!file) return null;
    
    // Check if URL is expired
    if (fileService.isUrlExpired(file)) {
      console.log('URL expired, refreshing...', file.name);
      // Refresh URLs from the API
      const result = await refreshUrlsCallback();
      if (result && result.items) {
        // Find the updated file in the tree
        const updatedFile = fileService.findFileByName(directoryTree, file.name);
        if (updatedFile) {
          // Update the file object that was passed in
          file.url = updatedFile.url;
          file.expiry_timestamp = updatedFile.expiry_timestamp;
          file.expiry_unix = updatedFile.expiry_unix;
          file.model_url = updatedFile.model_url;
          // Clear cached model when URL changes
          file.model = null;
          return updatedFile.url;
        }
      }
      // If refresh failed, return null
      return null;
    }
    
    return file.url;
  }
};

