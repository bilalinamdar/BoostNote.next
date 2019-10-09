import React, { useMemo, useCallback, MouseEventHandler } from 'react'
import SideNavigatorItem, { NavigatorNode } from './SideNavigatorItem'
import { NoteStorage } from '../../lib/db/types'
import { mdiTagMultiple, mdiTrashCan } from '@mdi/js'
import { useContextMenu, MenuTypes } from '../../lib/contextMenu'
import { useDialog, DialogIconTypes } from '../../lib/dialog'

interface StorageNaviagtorItemProps {
  storage: NoteStorage
  renameStorage: (storageId: string, name: string) => Promise<void>
  removeStorage: (storageId: string) => Promise<void>
  createFolder: (storageId: string, folderPath: string) => Promise<void>
  removeFolder: (storageId: string, folderPath: string) => Promise<void>
}

type FolderTree = {
  [key: string]: FolderTree
}

const StorageNavigatorItem = ({
  storage,
  renameStorage,
  removeStorage,
  createFolder,
  removeFolder
}: StorageNaviagtorItemProps) => {
  const { prompt, messageBox } = useDialog()
  const contextMenu = useContextMenu()
  const { id: storageId, name: storageName } = storage
  const openContextMenu = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()

      contextMenu.popup(event, [
        {
          type: MenuTypes.Normal,
          label: 'New Folder',
          onClick: async () => {
            prompt({
              title: 'Create a Folder',
              message: 'Enter the path where do you want to create a folder',
              iconType: DialogIconTypes.Question,
              defaultValue: '/',
              submitButtonLabel: 'Create Folder',
              onClose: (value: string | null) => {
                if (value == null) return
                createFolder(storageId, value)
              }
            })
          }
        },
        {
          type: MenuTypes.Normal,
          label: 'Rename Storage',
          onClick: async () => {
            prompt({
              title: `Rename "${storageName}" storage`,
              message: 'Enter new name for the storage',
              iconType: DialogIconTypes.Question,
              defaultValue: storageName,
              submitButtonLabel: 'Rename Folder',
              onClose: (value: string | null) => {
                if (value == null) return
                renameStorage(storageId, value)
              }
            })
          }
        },
        {
          type: MenuTypes.Normal,
          label: 'Remove Storage',
          onClick: async () => {
            messageBox({
              title: `Remove "${storageName}" storage`,
              message: 'All notes and folders will be deleted.',
              iconType: DialogIconTypes.Warning,
              buttons: ['Remove Storage', 'Cancel'],
              defaultButtonIndex: 0,
              cancelButtonIndex: 1,
              onClose: (value: number | null) => {
                if (value === 0) {
                  removeStorage(storageId)
                }
              }
            })
          }
        }
      ])
    },
    [
      contextMenu,
      prompt,
      messageBox,
      createFolder,
      storageId,
      storageName,
      renameStorage,
      removeStorage
    ]
  )

  const createFolderContextMenuHandler = useCallback(
    (pathname: string) => {
      return (event: React.MouseEvent<HTMLLIElement>) => {
        const folderIsRootFolder = pathname === '/'

        event.preventDefault()
        contextMenu.popup(event, [
          {
            type: MenuTypes.Normal,
            label: 'New Folder',
            onClick: async () => {
              prompt({
                title: 'Create a Folder',
                message: 'Enter the path where do you want to create a folder',
                iconType: DialogIconTypes.Question,
                defaultValue: folderIsRootFolder ? '/' : `${pathname}/`,
                submitButtonLabel: 'Create Folder',
                onClose: (value: string | null) => {
                  if (value == null) return
                  createFolder(storageId, value)
                }
              })
            }
          },
          {
            type: MenuTypes.Normal,
            label: 'Remove Folder',
            enabled: !folderIsRootFolder,
            onClick: () => {
              messageBox({
                title: `Remove "${pathname}" folder`,
                message: 'All notes and subfolders will be deleted.',
                iconType: DialogIconTypes.Warning,
                buttons: ['Remove Folder', 'Cancel'],
                defaultButtonIndex: 0,
                cancelButtonIndex: 1,
                onClose: (value: number | null) => {
                  if (value === 0) {
                    removeFolder(storageId, pathname)
                  }
                }
              })
            }
          }
        ])
      }
    },
    [contextMenu, storageId, messageBox, prompt, createFolder, removeFolder]
  )

  const folderNodes = useMemo(() => {
    const folderTree = getFolderTree(Object.keys(storage.folderMap))

    return getNavigatorNodeFromPathnameTree(
      folderTree,
      storageId,
      '/',
      createFolderContextMenuHandler
    )
  }, [storageId, storage.folderMap, createFolderContextMenuHandler])
  const tagNodes = Object.keys(storage.tagMap).map(tagName => ({
    name: tagName,
    href: `/storages/${storage.id}/tags/${tagName}`
  }))

  const node = useMemo(() => {
    return {
      name: storage.name,
      href: `/storages/${storage.id}`,
      onContextMenu: openContextMenu,
      children: [
        {
          name: 'Notes',
          href: `/storages/${storage.id}/notes`,
          onContextMenu: createFolderContextMenuHandler('/')
        },
        ...folderNodes,
        {
          iconPath: mdiTagMultiple,
          name: 'Tags',
          children: tagNodes
        },
        {
          iconPath: mdiTrashCan,
          name: 'Trash Can'
        }
      ]
    }
  }, [
    storage,
    folderNodes,
    tagNodes,
    openContextMenu,
    createFolderContextMenuHandler
  ])

  return <SideNavigatorItem node={node} />
}

export default StorageNavigatorItem

function getFolderTree(pathnames: string[]) {
  const tree = {}
  for (const pathname of pathnames) {
    if (pathname === '/') continue
    const [, ...folderNames] = pathname.split('/')
    let currentNode = tree
    for (let index = 0; index < folderNames.length; index++) {
      const currentPathname = folderNames[index]
      if (currentNode[currentPathname] == null) {
        currentNode[currentPathname] = {}
      }
      currentNode = currentNode[currentPathname]
    }
  }

  return tree
}

function getNavigatorNodeFromPathnameTree(
  tree: FolderTree,
  storageId: string,
  parentFolderPathname: string,
  contextMenuHandlerCreator: (pathname: string) => MouseEventHandler
): NavigatorNode[] {
  return Object.entries(tree).map(([folderName, tree]) => {
    const folderPathname =
      parentFolderPathname === '/'
        ? `/${folderName}`
        : `${parentFolderPathname}/${folderName}`
    const pathname = `/storages/${storageId}/notes${folderPathname}`
    return {
      name: folderName,
      href: pathname,
      onContextMenu: contextMenuHandlerCreator(folderPathname),
      children: getNavigatorNodeFromPathnameTree(
        tree,
        storageId,
        folderPathname,
        contextMenuHandlerCreator
      )
    }
  })
}