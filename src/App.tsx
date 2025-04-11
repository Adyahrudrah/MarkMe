import { 
  useState, 
  useEffect, 
  useMemo, 
  useRef, 
  createContext, 
  useContext,
  useCallback 
,
} from "react";
import type { ChromeBookmarkNode } from "./types/types";
import "./index.css";

// Create Bookmark Context
const BookmarkContext = createContext<{
  bookmarks: ChromeBookmarkNode[];
  refreshBookmarks: () => void;
}>({
  bookmarks: [],
  refreshBookmarks: () => {}
});

function App() {
  const [bookmarks, setBookmarks] = useState<ChromeBookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshBookmarks = useCallback(() => {
    chrome.bookmarks.getTree((tree) => {
      setBookmarks(tree[0].children || []);
    });
  }, []);

  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  return (
    <BookmarkContext.Provider value={{ bookmarks, refreshBookmarks }}>
      <div className="bookmarks-container">
        <div className="search-container">
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
        <BookmarkTree
          bookmarkTree={bookmarks}
          searchQuery={searchQuery}
        />
      </div>
    </BookmarkContext.Provider>
  );
}

const BookmarkTree = ({
  bookmarkTree,
  searchQuery = ""
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
      return titleMatch || bookmark.children.some(child => shouldShow(child));
    }

    return titleMatch || urlMatch;
  };

  const renderBookmarkNode = (bookmark: ChromeBookmarkNode): JSX.Element | null => {
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
    .filter(node => node !== null);

  if (searchQuery && visibleBookmarks.length === 0) {
    return <div className="no-results">No bookmarks found</div>;
  }

  return <div className="bookmarks-list">{visibleBookmarks}</div>;
};

const BookmarkNode = ({
  bookmark,
  isSearchResult = false,
  searchQuery = "" // Add this prop
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
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  const faviconRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (bookmark.url) {
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const faviconSources = useMemo(() => {
    if (!bookmark.url) return [];
    try {
      const url = new URL(bookmark.url);
      const hostname = url.hostname;
      return [
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

  return (
    <section 
      className="bookmark-folder" 
      ref={containerRef}
      onContextMenu={handleContextMenu}
    >
      {bookmark.children && (
        <span onClick={toggleBookmark} className="bookmark-title">
          {bookmark.title.replace("_", " ")}
        </span>
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
            {isVisible && bookmark.url && !faviconError && faviconSources.length > 0 && (
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
                i === 0 ? <i key={i}>{t}</i> : <em key={i} className="title-desc">{t}</em>
              )}
            </a>
            <button onClick={handleDelete} className="delete-bookmark" title="Delete">
              <i className="fa-solid fa-trash"></i>
            </button>
          </p>

          {showContextMenu && (
            <div 
              className="context-menu-container"
              style={{
                position: 'fixed',
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
                zIndex: 1000
              }}
            >
              <BookmarkContextMenu 
                bookmarkId={bookmark.id}
                onClose={closeContextMenu}
                currentParentId={bookmark.parentId || '1'}
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
  currentParentId
}: {
  bookmarkId: string;
  onClose: () => void;
  currentParentId: string;
}) => {
  const { refreshBookmarks } = useContext(BookmarkContext);
  const [folders, setFolders] = useState<ChromeBookmarkNode[]>([]);

  useEffect(() => {
    chrome.bookmarks.getTree((tree) => {
      const flattenFolders = (nodes: ChromeBookmarkNode[]): ChromeBookmarkNode[] => {
        return nodes.reduce<ChromeBookmarkNode[]>((acc, node) => {
          if (node.children) {
            return [...acc, node, ...flattenFolders(node.children)];
          }
          return acc;
        }, []);
      };
      setFolders(flattenFolders(tree[0].children || []).filter(f => f.id !== bookmarkId));
    });
  }, [bookmarkId]);

  const handleMove = (folderId: string) => {
    if (folderId && folderId !== currentParentId) {
      chrome.bookmarks.move(bookmarkId, { parentId: folderId }, refreshBookmarks);
      onClose();
    }
  };

  return (
    <div className="context-menu">
      <div className="context-menu-header">
        <h4>Move Bookmark</h4>
        <button onClick={onClose} className="close-btn">
          <i className="fas fa-times"></i>
        </button>
      </div>
      <ul className="folder-list">
        {folders.map(folder => (
          <li 
            key={folder.id}
            className="folder-item"
            onClick={() => handleMove(folder.id)}
          >
            <i className="fas fa-folder"></i>
            <span className="folder-title">{folder.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App;