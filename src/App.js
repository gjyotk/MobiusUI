import {
  Box,
  Button,
  CssBaseline,
  ThemeProvider,
  createTheme,
  LinearProgress,
  Typography,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TreeView from "@mui/lab/TreeView";
import TreeItem from "@mui/lab/TreeItem";

// Custom Components
import TopBar from "./components/TopBar";

import "./App.css";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { API_URL } from "./Constants";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

const lightTheme = createTheme({
  palette: {
    mode: "light",
  },
});

// Helper function to create delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function renderTree(data, onClick, loadChildren, loadingNodes) {
  return Object.entries(data).map(([key, value]) => {
    const nodeId = value.path || key;
    const isLoading = loadingNodes.has(nodeId);
    
    if (value.hasChildren) {
      return (
        <TreeItem 
          key={nodeId} 
          nodeId={nodeId} 
          label={isLoading ? `${key} (Loading...)` : key}
          onIconClick={() => {
            if (!value.children && !isLoading) {
              loadChildren(nodeId, value.url);
            }
          }}
        >
          {value.children && renderTree(value.children, onClick, loadChildren, loadingNodes)}
        </TreeItem>
      );
    } else {
      return (
        <TreeItem
          key={nodeId}
          nodeId={nodeId}
          label={key}
          onClick={() => {
            onClick(value.content);
          }}
        />
      );
    }
  });
}

const fetchNodeChildren = async (url, parentId) => {
  
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: url + "?rcn=4",
    headers: {
      Accept: "application/json",
      "X-M2M-RI": "12345",
      "X-M2M-Origin": "S{{aei}}",
    },
  };

  try {
    let response = await axios.request(config);
    let children = {};
    let childCount = 0;
    
    for (let key in response.data["m2m:rsp"]) {
      let arr = response.data["m2m:rsp"][key];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i]["pi"] === parentId) {
          const childPath = `${url}/${arr[i]["rn"]}`;
          if (arr[i]["con"]) {
            // Leaf node with content
            children[arr[i]["rn"]] = {
              content: arr[i]["con"],
              hasChildren: false,
              path: childPath
            };
          } else {
            // Branch node - has children but not loaded yet
            children[arr[i]["rn"]] = {
              hasChildren: true,
              children: null,
              url: childPath,
              parentId: arr[i]["ri"],
              path: childPath
            };
            console.log("Added branch node:", arr[i]["rn"]);
          }
          childCount++;
        }
      }
    }
    return children;
  } catch (error) {
    console.log("Error fetching children:", error);
    return {};
  }
};

const fetchDepthFirst = async (url, parentId, nodeName, depth = 0) => {
  
  const children = await fetchNodeChildren(url, parentId);
  
  if (Object.keys(children).length === 0) {
    return children;
  }
  
  // Recursively load children for branch nodes
  for (let [childName, childData] of Object.entries(children)) {
    if (childData.hasChildren) {
      const grandChildren = await fetchDepthFirst(childData.url, childData.parentId, childName, depth + 1);
      children[childName].children = grandChildren;
    }
  }
  
  return children;
};

const fetchRootData = async (setLoadingProgress) => {
  
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: API_URL,
    headers: {
      Accept: "application/json",
      "X-M2M-RI": "12345",
      "X-M2M-Origin": "S{{aei}}",
    },
  };

  try {
    let response = await axios.request(config);
    
    let rootName = response.data["m2m:cb"]["rn"];
    let rootId = response.data["m2m:cb"]["ri"];
    
    console.log("Root node name:", rootName, "ID:", rootId);
    
    // Load first level children
    const firstLevelChildren = await fetchNodeChildren(API_URL, rootId);
    console.log("First level loaded with", Object.keys(firstLevelChildren).length, "children");
    
    const childrenEntries = Object.entries(firstLevelChildren);
    const rootData = {
      [rootName]: {
        hasChildren: true,
        children: firstLevelChildren,
        url: API_URL,
        parentId: rootId,
        path: rootName
      }
    };
    
    return { rootData, childrenEntries, rootName };
  } catch (error) {
    console.log("Error fetching root data:", error);
    return { rootData: {}, childrenEntries: [], rootName: "" };
  }
};

// Progressive loading function that processes nodes in batches
const progressivelyLoadNodes = async (
  childrenEntries, 
  rootName, 
  setDATA, 
  setLoadingProgress,
  batchSize = 30, 
  delayBetweenBatches = 2000 // 2 seconds delay
) => {
  const totalNodes = childrenEntries.length;
  let processedNodes = 0;
  
  for (let startIndex = 0; startIndex < totalNodes; startIndex += batchSize) {
    const endIndex = Math.min(startIndex + batchSize, totalNodes);
    const currentBatch = childrenEntries.slice(startIndex, endIndex);
    
    // Process current batch with depth-first loading
    const batchPromises = currentBatch.map(async ([childName, childData]) => {
      if (childData.hasChildren) {
        const depthLoadedChildren = await fetchDepthFirst(childData.url, childData.parentId, childName, 1);
        return { childName, children: depthLoadedChildren };
      }
      return { childName, children: null };
    });
    
    // Wait for current batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Update tree data with current batch
    setDATA(prevData => {
      const newData = { ...prevData };
      batchResults.forEach(({ childName, children }) => {
        if (children && newData[rootName] && newData[rootName].children && newData[rootName].children[childName]) {
          newData[rootName].children[childName].children = children;
        }
      });
      return newData;
    });
    
    processedNodes += currentBatch.length;
    const progress = (processedNodes / totalNodes) * 100;
    
    setLoadingProgress(progress);
    
    // Add delay between batches
    if (endIndex < totalNodes) {
      await sleep(delayBetweenBatches);
    }
  }
  
  setLoadingProgress(100);
  
  // Hide progress bar after completion
  setTimeout(() => {
    setLoadingProgress(null);
  }, 1000);
};

function App() {
  const [DATA, setDATA] = useState({});
  const [loadingNodes, setLoadingNodes] = useState(new Set());
  const [loadingProgress, setLoadingProgress] = useState(null);
  const progressiveLoadingRef = useRef(null);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingProgress(0);
      const { rootData, childrenEntries, rootName } = await fetchRootData(setLoadingProgress);
      
      setDATA(rootData);
      
      // Start progressive loading in background
      if (childrenEntries.length > 0) {
        progressiveLoadingRef.current = progressivelyLoadNodes(
          childrenEntries,
          rootName,
          setDATA,
          setLoadingProgress,
          30,
          2000
        );
      } else {
        setLoadingProgress(null);
      }
    };
    
    loadInitialData();
    
    return () => {
      if (progressiveLoadingRef.current) {
        progressiveLoadingRef.current = null;
      }
    };
  }, []);

  const [darkMode, setDarkMode] = useState(false);
  const [data, setData] = useState("");
  const [expanded, setExpanded] = useState([]);
  const [selected, setSelected] = useState([]);

  const loadChildren = async (nodeId, url) => {
    // Find the node in the tree and get its parentId
    const findNode = (obj, targetPath) => {
      for (let key in obj) {
        if (obj[key].path === targetPath) {
          return obj[key];
        }
        if (obj[key].children) {
          const found = findNode(obj[key].children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(DATA, nodeId);
    if (!node) {
      console.log("Node not found:", nodeId);
      return;
    }
    if (node.children) {
      console.log("Children already loaded for node:", nodeId);
      return;
    }

    setLoadingNodes(prev => new Set([...prev, nodeId]));

    try {
      // Use depth-first loading for on-demand loading as well
      const children = await fetchDepthFirst(url, node.parentId, nodeId.split('/').pop(), 0);
      // console.log("Depth-first loaded", Object.keys(children).length, "children for node:", nodeId);
      
      // Update the DATA state by adding children to the specific node
      setDATA(prevData => {
        const updateNode = (obj, targetPath, newChildren) => {
          const newObj = { ...obj };
          for (let key in newObj) {
            if (newObj[key].path === targetPath) {
              newObj[key] = { ...newObj[key], children: newChildren };
            } else if (newObj[key].children) {
              newObj[key] = { 
                ...newObj[key], 
                children: updateNode(newObj[key].children, targetPath, newChildren) 
              };
            }
          }
          return newObj;
        };
        
        return updateNode(prevData, nodeId, children);
      });
      
      // Auto-expand node after loading
      setExpanded(prev => [...prev, nodeId]);
    } catch (error) {
      console.log(" Failed to load children for node:", nodeId, "Error:", error);
    } finally {
      setLoadingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  const handleToggle = (event, nodeIds) => {
    setExpanded(nodeIds);
  };

  const handleSelect = (event, nodeIds) => {
    setSelected(nodeIds);
  };

  const getAllNodeIds = (obj) => {
    let ids = [];
    for (let key in obj) {
      ids.push(obj[key].path || key);
      if (obj[key].children) {
        ids = ids.concat(getAllNodeIds(obj[key].children));
      }
    }
    return ids;
  };

  const handleExpandClick = () => {
    const allIds = getAllNodeIds(DATA);
    setExpanded((oldExpanded) =>
      oldExpanded.length === 0 ? allIds : []
    );
  };

  const handleSelectClick = () => {
    const allIds = getAllNodeIds(DATA);
    setSelected((oldSelected) =>
      oldSelected.length === 0 ? allIds : []
    );
  };

  return (
    <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, p:2, minHeight: '100vh', dislay: "flex", justifyContent: "center" }}>
        <TopBar darkMode={darkMode} setDarkMode={setDarkMode} />
        
        {/* Progress indicator */}
        {loadingProgress !== null && (
          <Box sx={{ p: 2.5, margin: 3, width: 1300}}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Loading data: {loadingProgress.toFixed(1)}%
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={loadingProgress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
        
        {/* Two left and right Box */}
        <Box sx={{ display: "flex", justifyContent: "space-between", columnGap: "1rem", marginLeft: "2rem", p: 2, marginTop: "2rem"}}>
          {/* Left Box */}
          <Box sx={{ flexGrow: 1, p: 3, border: "2px solid #ADD8E6", borderRadius: "8px" }}>
            <Box sx={{ mb: 1, display: "flex",justifyContent: "space-around", p:2 }}>
              <Button variant="outlined" onClick={handleExpandClick}>
                {expanded.length === 0 ? "Expand all" : "Collapse all"}
              </Button>
              <Button variant="outlined" onClick={handleSelectClick}>
                {selected.length === 0 ? "Select all" : "Unselect all"}
              </Button>
            </Box>
            <TreeView
              aria-label="controlled"
              defaultCollapseIcon={<ExpandMoreIcon />}
              defaultExpandIcon={<ChevronRightIcon />}
              expanded={expanded}
              selected={selected}
              onNodeToggle={handleToggle}
              onNodeSelect={handleSelect}
              multiSelect
            >
              {renderTree(DATA, setData, loadChildren, loadingNodes)}
            </TreeView>
          </Box>
          {/* Right Box */}
          <Box sx={{ flexGrow: 1, p: 2, border: "2px solid #ADD8E6", display: "flex", borderRadius: "8px", marginRight: "2rem", justifyContent:"center"  }}>
            {data ? data : "Click on any data container to view data!"}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}


export default App;