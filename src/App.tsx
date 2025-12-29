import {
  useState,
  useEffect,
  useMemo,
  useRef,
  createContext,
  useContext,
  useCallback,
  JSX,
} from "react";
import type { ChromeBookmarkNode } from "./types/types";
import "./index.css";

// Create Bookmark Context
const BookmarkContext = createContext<{
  bookmarks: ChromeBookmarkNode[];
  refreshBookmarks: () => void;
}>({
  bookmarks: [],
  refreshBookmarks: () => {},
});

function App() {
  const [bookmarks, setBookmarks] = useState<ChromeBookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState("1"); // Default to bookmarks bar
  const [availableFolders, setAvailableFolders] = useState<
    ChromeBookmarkNode[]
  >([]);

  const fetchAllFolders = useCallback(() => {
    chrome.bookmarks.getTree((tree) => {
      const flattenFolders = (
        nodes: ChromeBookmarkNode[]
      ): ChromeBookmarkNode[] => {
        return nodes.reduce<ChromeBookmarkNode[]>((acc, node) => {
          if (node.children) {
            return [...acc, node, ...flattenFolders(node.children)];
          }
          return acc;
        }, []);
      };
      setAvailableFolders(flattenFolders(tree[0].children || []));
    });
  }, []);

  const refreshBookmarks = useCallback(() => {
    chrome.bookmarks.getTree((tree) => {
      setBookmarks(tree[0].children || []);
    });
  }, []);

  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  const openFolderCreation = useCallback(() => {
    fetchAllFolders();
    setIsCreatingFolder(true);
  }, [fetchAllFolders]);

  const createFolder = useCallback(() => {
    if (!newFolderName.trim()) return;

    chrome.bookmarks.create(
      {
        parentId: newFolderParentId,
        title: newFolderName,
      },
      () => {
        refreshBookmarks();
        setIsCreatingFolder(false);
        setNewFolderName("");
      }
    );
  }, [newFolderName, newFolderParentId, refreshBookmarks]);

  return (
    <BookmarkContext.Provider value={{ bookmarks, refreshBookmarks }}>
      <div className="bookmarks-container">
        <div className="search-container">
          <button
            className="create-bookmark-folder"
            onClick={openFolderCreation}
          >
            <i className="fa-solid fa-folder"></i>
          </button>
          <div className="searchWrapper">
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <i className="fa-solid fa-search"></i>
          </div>
        </div>
        <BookmarkTree bookmarkTree={bookmarks} searchQuery={searchQuery} />
      </div>
      {isCreatingFolder && (
        <div className="modal-overlay">
          <div
            className="modal-content bg-zinc-800 text-zinc-300"
            style={{ width: "400px" }}
          >
            <h3>Create New Folder</h3>
            <div className="form-group bg-zinc-800">
              <label>Folder Name</label>
              <input
                type="text"
                placeholder="Enter folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group ">
              <label>Parent Folder</label>
              <div className="folder-select-container">
                <ul className="folder-list">
                  {availableFolders.map((folder) => (
                    <li
                      key={folder.id}
                      className={`folder-item ${
                        newFolderParentId === folder.id
                          ? "bg-zinc-300 text-zinc-900"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                      onClick={() => setNewFolderParentId(folder.id)}
                    >
                      <i className="fas fa-folder"></i>
                      <span className="folder-title">{folder.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setIsCreatingFolder(false)}>Cancel</button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="primary"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </BookmarkContext.Provider>
  );
}

const BookmarkTree = ({
  bookmarkTree,
  searchQuery = "",
}: {
  bookmarkTree: ChromeBookmarkNode[];
  searchQuery?: string;
}) => {
  const shouldShow = (bookmark: ChromeBookmarkNode): boolean => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const titleMatch = bookmark.title.toLowerCase().includes(query);
    const urlMatch = bookmark.url?.toLowerCase().includes(query) || false;

    if (bookmark.children) {
      return titleMatch || bookmark.children.some((child) => shouldShow(child));
    }

    return titleMatch || urlMatch;
  };

  const renderBookmarkNode = (
    bookmark: ChromeBookmarkNode
  ): JSX.Element | null => {
    if (searchQuery && !shouldShow(bookmark)) return null;

    return (
      <BookmarkNode
        key={bookmark.id}
        bookmark={bookmark}
        isSearchResult={searchQuery.length > 0}
        searchQuery={searchQuery} // Pass it down
      />
    );
  };

  const visibleBookmarks = bookmarkTree
    .map(renderBookmarkNode)
    .filter((node) => node !== null);

  if (searchQuery && visibleBookmarks.length === 0) {
    return <div className="no-results">No bookmarks found</div>;
  }

  return <div className="bookmarks-list">{visibleBookmarks}</div>;
};

const BookmarkNode = ({
  bookmark,
  isSearchResult = false,
  searchQuery = "", // Add this prop
}: {
  bookmark: ChromeBookmarkNode;
  isSearchResult?: boolean;
  searchQuery?: string; // Add to prop types
}) => {
  const { refreshBookmarks } = useContext(BookmarkContext);
  const [isToggled, setIsToggled] = useState(isSearchResult);
  const [faviconError, setFaviconError] = useState(false);
  const [currentFaviconIndex, setCurrentFaviconIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });

  const faviconRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    if (bookmark.url) {
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate adjusted position
      let x = e.clientX;
      let y = e.clientY;

      // Context menu dimensions (estimate or calculate if known)
      const menuWidth = 500; // Adjust based on your actual menu width
      const menuHeight = 400; // Adjust based on your actual menu height

      console.log(x, y, menuHeight);

      // Adjust if too close to right edge
      if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 5; // 5px padding from edge
      }

      // Adjust if too close to bottom edge
      if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 5; // 5px padding from edge
      }

      setContextMenuPosition({ x, y });
      setShowContextMenu(true);
    }
  };

  const closeContextMenu = () => {
    setShowContextMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const faviconSources = useMemo(() => {
    if (!bookmark.url) return [];
    try {
      const url = new URL(bookmark.url);
      const hostname = url.hostname;
      return [
        `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
        `${url.protocol}//${hostname}/favicon.ico`,
        `${url.protocol}//${hostname}/favicon.png`,
        `${url.protocol}//www.${hostname}/favicon.ico`,
      ];
    } catch {
      return [];
    }
  }, [bookmark.url]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { root: null, rootMargin: "100px", threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isSearchResult) {
      chrome.storage.local.get(["bookmarkToggles"], (result) => {
        const toggles = result.bookmarkToggles || {};
        if (toggles[bookmark.id] !== undefined) {
          setIsToggled(toggles[bookmark.id]);
        }
      });
    }
  }, [bookmark.id, isSearchResult]);

  const handleFaviconError = () => {
    if (currentFaviconIndex < faviconSources.length - 1) {
      setCurrentFaviconIndex(currentFaviconIndex + 1);
    } else {
      setFaviconError(true);
    }
  };

  const toggleBookmark = () => {
    const newState = !isToggled;
    setIsToggled(newState);
    if (!isSearchResult) {
      chrome.storage.local.get(["bookmarkToggles"], (result) => {
        const toggles = result.bookmarkToggles || {};
        toggles[bookmark.id] = newState;
        chrome.storage.local.set({ bookmarkToggles: toggles });
      });
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${bookmark.title}"?`)) {
      chrome.bookmarks.remove(bookmark.id, refreshBookmarks);
    }
  };

  const handleDeleteFolder = (bookmark: ChromeBookmarkNode) => {
    chrome.bookmarks.remove(bookmark.id, refreshBookmarks);
  };

  return (
    <section
      className="bookmark-folder"
      ref={containerRef}
      onContextMenu={handleContextMenu}
    >
      {bookmark.children && (
        <div className="flex justify-between">
          <span onClick={toggleBookmark} className="bookmark-title">
            {bookmark.title.replace("_", " ")}
            {bookmark.children.length === 0 && (
              <span
                className="fa-solid fa-trash ml-6"
                onClick={() => handleDeleteFolder(bookmark)}
              ></span>
            )}
          </span>
        </div>
      )}

      {(isSearchResult || isToggled) && bookmark.children && (
        <BookmarkTree
          bookmarkTree={bookmark.children}
          searchQuery={searchQuery}
        />
      )}

      {!bookmark.children && (
        <div ref={nodeRef} className="bookmark-url">
          <p className="bookmarkContent">
            {isVisible &&
              bookmark.url &&
              !faviconError &&
              faviconSources.length > 0 && (
                <img
                  ref={faviconRef}
                  src={faviconSources[currentFaviconIndex]}
                  alt="Favicon"
                  className="bookmark-favicon"
                  onError={handleFaviconError}
                  onLoad={() => setFaviconError(false)}
                />
              )}
            {faviconError && <i className="fas fa-bookmark"></i>}
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
              {bookmark.title.split(/:|-|\|/).map((t, i) =>
                i === 0 ? (
                  <i key={i}>{t}</i>
                ) : (
                  <em key={i} className="title-desc">
                    {t}
                  </em>
                )
              )}
            </a>
            <button
              onClick={handleDelete}
              className="delete-bookmark"
              title="Delete"
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          </p>

          {showContextMenu && (
            <div
              className="context-menu-container"
              style={{
                position: "fixed",
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
                zIndex: 1000,
              }}
            >
              <BookmarkContextMenu
                bookmarkId={bookmark.id}
                onClose={closeContextMenu}
                currentParentId={bookmark.parentId || "1"}
                searchQuery={searchQuery}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const BookmarkContextMenu = ({
  bookmarkId,
  onClose,
  currentParentId,
  searchQuery,
}: {
  bookmarkId: string;
  onClose: () => void;
  currentParentId: string;
  searchQuery: string;
}) => {
  const { refreshBookmarks } = useContext(BookmarkContext);
  const [folders, setFolders] = useState<ChromeBookmarkNode[]>([]);

  useEffect(() => {
    chrome.bookmarks.getTree((tree) => {
      const flattenFolders = (
        nodes: ChromeBookmarkNode[]
      ): ChromeBookmarkNode[] => {
        return nodes.reduce<ChromeBookmarkNode[]>((acc, node) => {
          if (node.children) {
            return [...acc, node, ...flattenFolders(node.children)];
          }
          return acc;
        }, []);
      };
      setFolders(
        flattenFolders(tree[0].children || [])
          .filter((f) => f.id !== bookmarkId)
          .sort((a, b) => {
            const aMatches = a.title
              .toLocaleString()
              .toLowerCase()
              .includes(searchQuery.toLocaleString().toLowerCase());
            const bMatches = b.title
              .toLocaleString()
              .toLowerCase()
              .includes(searchQuery.toLocaleString().toLowerCase());

            // If both match or neither matches, sort alphabetically
            if (aMatches === bMatches) {
              return a.title
                .toLocaleString()
                .localeCompare(b.title.toLocaleString());
            }
            // If a matches but b doesn't, a comes first
            else if (aMatches) {
              return -1;
            }
            // If b matches but a doesn't, b comes first
            else {
              return 1;
            }
          })
      );
    });
  }, [bookmarkId]);

  const handleMove = (folderId: string) => {
    if (folderId && folderId !== currentParentId) {
      chrome.bookmarks.move(
        bookmarkId,
        { parentId: folderId },
        refreshBookmarks
      );
      onClose();
    }
  };

  return (
    <div className="context-menu">
      <div className="context-menu-header p-2">
        <h4>Move Bookmark To</h4>
        <button onClick={onClose} className="close-btn">
          <i className="fas fa-times text-yellow-400"></i>
        </button>
      </div>
      <ul className="folder-list overscroll-none">
        {folders.map((folder) => (
          <li
            key={folder.id}
            className="folder-item"
            onClick={() => handleMove(folder.id)}
          >
            <i className="fas fa-folder"></i>
            <span className="folder-title text-zinc-300">{folder.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App;
