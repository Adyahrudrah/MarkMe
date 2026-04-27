import React, { useContext, useEffect, useState } from "react";
import { BookmarkContext } from "../App";
import type { ChromeBookmarkNode } from "../types/types";

export const BookmarkContextMenu = ({
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

	const [breakCrumb, setBreakCrumb] = useState<string>("");

	useEffect(() => {
		chrome.bookmarks.getTree((tree) => {
			const flattenFolders = (
				nodes: ChromeBookmarkNode[],
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
					}),
			);
		});
	}, [bookmarkId, searchQuery.toLocaleString]);

	const calculatePath = (targetId: string) => {
		const path: string[] = [];
		let currentId: string | undefined = targetId;

		while (currentId) {
			const folder = folders.find((f) => f.id === currentId);
			if (folder) {
				path.unshift(folder.title);
				currentId = folder.parentId;
			} else {
				currentId = undefined;
			}
		}
		return path.join(" -> ");
	};

	const handleMouseEnter = (folderId: string) => {
		const fullPath = calculatePath(folderId);
		setBreakCrumb(fullPath);
	};

	const handleMove = (folderId: string) => {
		if (folderId && folderId !== currentParentId) {
			chrome.bookmarks.move(
				bookmarkId,
				{ parentId: folderId },
				refreshBookmarks,
			);
			onClose();
		}
	};

	interface Folder {
		id: string;
		title: string;
	}

	const groupedFolders = folders.reduce<Record<string, Folder[]>>(
		(acc, folder) => {
			const firstLetter = folder.title.charAt(0).toUpperCase();

			if (!acc[firstLetter]) {
				acc[firstLetter] = [] as Folder[];
			}
			acc[firstLetter].push(folder);

			return acc;
		},
		{},
	);

	const sortedLetters = Object.keys(groupedFolders).sort();

	return (
		<div className="context-menu">
			<div className="flex-col text-white flex w-full sticky bg-[#6d1718] top-0 p-2">
				<div className="flex p-2 items-center justify-between  w-full">
					<h4 className="">Move Bookmark To</h4>

					<button type="button" onClick={onClose} className="close-btn">
						<i className="fas fa-times text-yellow-400"></i>
					</button>
				</div>
				<div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium truncate">
					<i className="fas fa-sitemap text-[9px]"></i>
					<span>{breakCrumb || "Select destination"}</span>
				</div>
			</div>

			<ul className="folder-list overscroll-none">
				{sortedLetters.map((letter) => (
					<React.Fragment key={letter}>
						<div className="w-full"></div>
						<li className="alphabet-header px-2 py-1 flex items-center bg-zinc-800 text-yellow-500 font-bold rounded-lg">
							{letter}
						</li>

						{groupedFolders[letter].map((folder) => (
							<li
								key={folder.id}
								className="folder-item"
								onMouseEnter={() => handleMouseEnter(folder.id)}
							>
								<button type="button" onClick={() => handleMove(folder.id)}>
									<i className="fas fa-folder"></i>
									<span className="folder-title text-zinc-300">
										{folder.title}
									</span>
								</button>
							</li>
						))}
					</React.Fragment>
				))}
			</ul>
		</div>
	);
};
