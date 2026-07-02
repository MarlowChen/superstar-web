import { Branch } from "@/payload-types";
import { useState, useCallback } from "react";

const useOptimizedMessageUpdate = (initialMessages: Branch[] = []) => {
  const [currentMessages, setCurrentMessages] =
    useState<Branch[]>(initialMessages);

  const updateEachMessage = useCallback((newBranch: Branch) => {
    setCurrentMessages((prevMessages) => {
      const updatedMessages = prevMessages.map((prevMsg) => {
        if (prevMsg.id === newBranch.id) {
          return newBranch;
        }
        return prevMsg;
      });
      return updatedMessages;
    });
  }, []);


  const updateMessages = useCallback(
    (newBranch: Branch[]) => {
      setCurrentMessages((prevMessages) => {
        // 找到變化的消息
        const changedMessage = newBranch.find((newMsg, index) => {
          const prevMsg = prevMessages[index];
          if (!prevMsg) return true;
          
          // 如果只是 ID 改變，內容沒變，保留舊的消息
          if (
            newMsg.id !== prevMsg.id && 
            newMsg.content[0].text === prevMsg.content[0].text &&
            newMsg.status === prevMsg.status
          ) {
            return false;
          }
          
          return JSON.stringify(newMsg) !== JSON.stringify(prevMsg);
        });
  
        if (!changedMessage) {
          return prevMessages;
        }
  
        return newBranch.map((newMsg, index) => {
          const prevMsg = prevMessages[index];
          if (!prevMsg) return newMsg;
  
          // 如果只是 ID 改變且內容相同，保留其他屬性
          if (
            newMsg.id !== prevMsg.id && 
            newMsg.content[0].text === prevMsg.content[0].text &&
            newMsg.status === prevMsg.status
          ) {
            return {
              ...prevMsg,
              id: newMsg.id
            };
          }
  
          return newMsg;
        });
      });
    },
    []
  );

  const removeLastMessage = useCallback(() => {
    setCurrentMessages((prevMessages) => {
      if (prevMessages.length > 0) {
        return prevMessages.slice(0, -1);
      }
      return prevMessages;
    });
  }, []);

  const addNewMessages = useCallback((newMessages: Branch[]) => {
    setCurrentMessages((prevMessages) => {
      const updatedMessages = [...prevMessages];
   
      newMessages.forEach(newMessage => {
        // 找到現有消息的索引
        const existingIndex = updatedMessages.findIndex(
          (msg) => msg.id === newMessage.id  
        );
   
        // 如果消息已存在,更新它
        if (existingIndex !== -1) {
          updatedMessages[existingIndex] = newMessage;
        } else {
          // 處理 parent 關係
          const parentMessageIndex = updatedMessages.findIndex(
            (pre) => pre.id === newMessage.parentId
          );
   
          const parentMessage = updatedMessages[parentMessageIndex];
          if (
            parentMessageIndex !== -1 &&
            parentMessage && 
            !parentMessage.childrenIds.some((id) => id === newMessage.id)
          ) {
            updatedMessages[parentMessageIndex] = {
              ...parentMessage,
              childrenIds: [...parentMessage.childrenIds, newMessage.id]
            };
          }
          
          // 如果是新消息就添加
          updatedMessages.push(newMessage);
        }
      });
   
      return updatedMessages;
    });
   }, []);

  //   const addNewAssistantMessage = useCallback((newMessage: Branch) => {
  //     if (newMessage.role !== "assistant") {
  //       console.warn(
  //         "Attempted to add non-assistant message using addNewAssistantMessage"
  //       );
  //       return;
  //     }
  //     setCurrentMessages([...currentMessages, newMessage]);
  //   }, []);

  return {
    currentMessages,
    setCurrentMessages,
    updateMessages,
    removeLastMessage,
    addNewMessages,
    updateEachMessage,
  };
};

export default useOptimizedMessageUpdate;
