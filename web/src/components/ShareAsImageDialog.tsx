import { Button, IconButton } from "@mui/joy";
import html2canvas from "html2canvas-pro";
import { Download, QrCode, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import QRCode from "qrcode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { memoStore, userStore } from "@/store/v2";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import UserAvatar from "./UserAvatar";

const MIN_CARD_WIDTH = 400;
const MAX_CARD_WIDTH = 900;
const CARD_PADDING = 24;

interface Props extends DialogProps {
  memo: Memo;
}

const ShareAsImageDialog: React.FC<Props> = observer(({ destroy, memo }: Props) => {
  const t = useTranslate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // 获取用户信息
  const user = userStore.getUserByName(memo.creator);
  const memoUrl = `${window.location.origin}/${memo.name}`;

  // 生成二维码
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(memoUrl, {
          width: 120,
          margin: 1,
          color: {
            dark: "#1f2937",
            light: "#ffffff",
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error("生成二维码失败:", error);
      }
    };
    generateQRCode();
  }, [memoUrl]);

  // 格式化时间
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  // 处理memo内容，智能截断并去除复杂格式
  const formatMemoContent = (content: string) => {
    // 移除复杂的markdown语法，保留基本格式
    let formatted = content
      .replace(/```[\s\S]*?```/g, "[代码块]") // 移除代码块
      .replace(/!\[.*?\]\(.*?\)/g, "[图片]") // 移除图片
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 移除链接，保留文本
      .replace(/#{1,6}\s/g, "") // 移除标题标记
      .replace(/\*\*(.*?)\*\*/g, "$1") // 移除粗体标记
      .replace(/\*(.*?)\*/g, "$1") // 移除斜体标记
      .replace(/`([^`]+)`/g, "$1") // 移除行内代码标记
      .trim();

    // 智能长度限制 - 根据内容长度动态调整，支持最长8192字符
    let maxLength: number;
    if (formatted.length <= 1500) {
      maxLength = formatted.length; // 短文完整显示
    } else if (formatted.length <= 3000) {
      maxLength = Math.min(2000, formatted.length); // 中长文适度截断
    } else {
      maxLength = Math.min(2500, formatted.length); // 长文保留核心内容
    }
    
    if (formatted.length > maxLength) {
      // 尝试在句号、感叹号或问号处截断
      const sentences = formatted.substring(0, maxLength);
      const lastSentenceEnd = Math.max(
        sentences.lastIndexOf('。'),
        sentences.lastIndexOf('！'),
        sentences.lastIndexOf('？'),
        sentences.lastIndexOf('.'),
        sentences.lastIndexOf('!'),
        sentences.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > maxLength * 0.7) {
        // 如果找到合适的句子结尾且不会截断太多内容
        formatted = sentences.substring(0, lastSentenceEnd + 1) + "...";
      } else {
        // 否则直接截断并添加省略号
        formatted = sentences + "...";
      }
    }

    return formatted;
  };

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // 高质量输出
        useCORS: true,
        allowTaint: true,
        width: cardRef.current.scrollWidth,
        height: cardRef.current.scrollHeight,
        ignoreElements: (element) => {
          // 忽略可能有问题的元素
          return element.tagName === 'IFRAME' || element.tagName === 'VIDEO';
        },
        onclone: (clonedDoc) => {
          // 处理克隆文档中的样式问题
          const clonedElement = clonedDoc.querySelector('[data-html2canvas-ignore]');
          if (clonedElement) {
            clonedElement.remove();
          }
        },
      });

      // 创建下载链接
      const link = document.createElement("a");
      const timestamp = memo.displayTime ? new Date(memo.displayTime).getTime() : memo.createTime ? new Date(memo.createTime).getTime() : Date.now();
      link.download = `memo-share-${timestamp}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("图片已保存");
    } catch (error) {
      console.error("生成图片失败:", error);
      toast.error("生成图片失败");
    } finally {
      setIsGenerating(false);
    }
  }, [memo]);

  const formattedContent = formatMemoContent(memo.content);

  // 检测暗色模式
  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 对话框头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">分享为图片</h2>
          <IconButton size="sm" variant="plain" onClick={destroy}>
            <X className="w-5 h-5" />
          </IconButton>
        </div>

        {/* 卡片预览区域 */}
        <div className="p-6">
          <div className="flex justify-center mb-6">
            <div
              ref={cardRef}
              className="rounded-3xl shadow-lg"
              style={{
                width: `${Math.min(Math.max(Math.sqrt(formattedContent.length) * 25 + 350, MIN_CARD_WIDTH), MAX_CARD_WIDTH)}px`,
                padding: `${CARD_PADDING * 1.5}px`,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
              }}
            >
              {/* 用户信息 */}
              <div className="flex items-center mb-8">
                <div 
                  className="w-10 h-10 mr-2 rounded-full overflow-hidden"
                  style={{
                    border: '3px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <UserAvatar
                    avatarUrl={user?.avatarUrl}
                    className="w-full h-full"
                  />
                </div>
                <div>
                  <div 
                    className="font-semibold text-xl"
                    style={{ color: '#ffffff' }}
                  >
                    {user?.nickname || user?.username || "匿名用户"}
                  </div>
                </div>
              </div>

              {/* Memo内容 */}
              <div className="mb-12">
                <div 
                  className="px-2 text-lg leading-relaxed whitespace-pre-wrap break-words"
                  style={{ 
                    color: '#e2e8f0',
                    lineHeight: '1.8'
                  }}
                >
                  {formattedContent}
                </div>
              </div>

              {/* 底部 - 标识和二维码 */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div 
                    className="text-sm"
                    style={{ 
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: '14px'
                    }}
                  >
                    {memo.displayTime ? formatDate(memo.displayTime) : memo.createTime ? formatDate(memo.createTime) : ""}
                  </div>
                  <div 
                    className="text-sm mb-1"
                    style={{ 
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '14px'
                    }}
                  >
                    Via Memos
                  </div>
                </div>
                {qrCodeDataUrl && (
                  <div 
                    className="rounded-lg p-1"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 1)',
                    }}
                  >
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-12 h-12" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-center">
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              startDecorator={<Download className="w-4 h-4" />}
              loading={isGenerating}
              size="lg"
            >
              {isGenerating ? "生成中..." : "下载图片"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function showShareAsImageDialog(memo: Memo): void {
  generateDialog(
    {
      className: "share-as-image-dialog",
      dialogName: "share-as-image-dialog",
    },
    ShareAsImageDialog,
    { memo }
  );
} 