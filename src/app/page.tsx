
'use client';

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, Sparkles, Download, Loader2, AlertTriangle, Upload, ImageIcon, Palette, Smile, BookOpen, CornerDownRight, FileImage, RotateCcw, Type, DownloadCloud } from 'lucide-react';
import { refineUserPrompt, generateImageFrames, type RefinePromptInput, type GenerateFramesInput } from './actions';
import { createGifFromPngs, type TextOverlayOptions } from '@/lib/gif-utils';
import { useToast } from "@/hooks/use-toast";

const STYLE_OPTIONS = [
  { value: 'default', label: 'Mặc định (Doodle)' },
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'watercolor', label: 'Màu nước' },
  { value: 'pencil-sketch', label: 'Phác thảo chì' },
  { value: '90s-cartoon', label: 'Hoạt hình thập niên 90' },
  { value: 'sticker', label: 'Nhãn dán (Sticker)'},
  { value: 'isometric', label: 'Isometric 3D'}
];

const MOOD_OPTIONS = [
  { value: 'default', label: 'Mặc định (Như mô tả)' },
  { value: 'joyful', label: 'Vui nhộn' },
  { value: 'fantasy', label: 'Huyền ảo' },
  { value: 'mysterious', label: 'Bí ẩn' },
  { value: 'calm', label: 'Yên bình' },
  { value: 'energetic', label: 'Năng động'}
];

const FONT_FAMILY_OPTIONS = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  { value: 'Impact', label: 'Impact' },
];

const TEXT_POSITION_OPTIONS = [
  { value: 'top-center', label: 'Trên Cùng - Giữa' },
  { value: 'middle-center', label: 'Chính Giữa' },
  { value: 'bottom-center', label: 'Dưới Cùng - Giữa' },
];

interface StorySegment {
  id: string;
  gifUrl: string;
  refinedPromptThisSegment: string;
  allFramesThisSegment: string[];
  originalUserPromptThisSegment: string;
  uploadedImageForThisSegmentDisplayUrl?: string | null;
}

export default function MagicalGifMakerPage() {
  const [promptValue, setPromptValue] = useState<string>('một chú chó shiba đang chạy trên đồng cỏ');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentGeneratedFrames, setCurrentGeneratedFrames] = useState<string[]>([]);
  const [currentGeneratedGifUrl, setCurrentGeneratedGifUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'frames' | 'output'>('frames');
  const [currentRefinedPromptText, setCurrentRefinedPromptText] = useState<string | null>(null);
  
  const [initialUploadedImageDisplayUrl, setInitialUploadedImageDisplayUrl] = useState<string | null>(null);
  const [initialUploadedImageDataUri, setInitialUploadedImageDataUri] = useState<string | undefined>(undefined);
  
  const [selectedStyle, setSelectedStyle] = useState<string>('default');
  const [selectedMood, setSelectedMood] = useState<string>('default');

  // Story Mode State
  const [storySegments, setStorySegments] = useState<StorySegment[]>([]);
  const [isInStoryMode, setIsInStoryMode] = useState<boolean>(false);
  const [nextStoryPromptInput, setNextStoryPromptInput] = useState<string>('');
  const [isLoadingNextSegment, setIsLoadingNextSegment] = useState<boolean>(false);
  const [nextSegmentUserUploadedImageDisplayUrl, setNextSegmentUserUploadedImageDisplayUrl] = useState<string | null>(null);
  const [nextSegmentUserUploadedImageDataUri, setNextSegmentUserUploadedImageDataUri] = useState<string | undefined>(undefined);

  // Text Overlay State
  const [textOverlayInput, setTextOverlayInput] = useState<string>('');
  const [textOverlayColor, setTextOverlayColor] = useState<string>('#FFFFFF'); // Default white
  const [textOverlayPosition, setTextOverlayPosition] = useState<TextOverlayOptions['position']>('bottom-center');
  const [textOverlayFontFamily, setTextOverlayFontFamily] = useState<string>('Arial');
  const [isApplyingTextOverlay, setIsApplyingTextOverlay] = useState<boolean>(false);

  // State for triggering success toasts via useEffect
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [successToastType, setSuccessToastType] = useState<'segmentAdded' | 'initialGifReady' | null>(null);


  const { toast } = useToast();
  const resultContainerRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const initialFileInputRef = useRef<HTMLInputElement>(null);
  const nextPromptInputRef = useRef<HTMLTextAreaElement>(null);
  const nextSegmentFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentGeneratedGifUrl && activeTab === 'output' && resultContainerRef.current) {
      resultContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentGeneratedGifUrl, activeTab]);

  // useEffect for showing success toasts
  useEffect(() => {
    if (showSuccessToast && successToastType) {
      if (successToastType === 'segmentAdded') {
        toast({ title: "Phần Mới Đã Được Thêm Vào Câu Chuyện!", description: "Hoạt ảnh của bạn đã được cập nhật." });
      } else if (successToastType === 'initialGifReady') {
        toast({ title: "GIF Đã Sẵn Sàng!", description: "Hoạt ảnh kỳ diệu của bạn đã hoàn tất." });
      }
      setShowSuccessToast(false); // Reset the trigger
      setSuccessToastType(null);  // Reset the type
    }
  }, [showSuccessToast, successToastType, toast]);


  const handlePromptFocus = () => {
    promptInputRef.current?.select();
  };
  
  const handleNextPromptFocus = () => {
    nextPromptInputRef.current?.select();
  };

  const handleInitialImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInitialUploadedImageDisplayUrl(URL.createObjectURL(file));
        setInitialUploadedImageDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setInitialUploadedImageDisplayUrl(null);
      setInitialUploadedImageDataUri(undefined);
    }
  };

  const handleNextSegmentImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNextSegmentUserUploadedImageDisplayUrl(URL.createObjectURL(file));
        setNextSegmentUserUploadedImageDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setNextSegmentUserUploadedImageDisplayUrl(null);
      setNextSegmentUserUploadedImageDataUri(undefined);
    }
  };


  const resetCurrentGenerationState = () => {
    setCurrentGeneratedFrames([]);
    setCurrentGeneratedGifUrl(null);
    setCurrentRefinedPromptText(null);
    setTextOverlayInput('');
    setActiveTab('frames');
  }

  const handleStartOrContinueStory = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    
    const currentPromptForGeneration = isInStoryMode ? nextStoryPromptInput : promptValue;

    if (!currentPromptForGeneration.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu Mô Tả",
        description: `Vui lòng nhập mô tả cho ${isInStoryMode ? "phần tiếp theo của câu chuyện" : "ảnh GIF của bạn"}.`,
      });
      return;
    }
    if (isGenerating || isLoadingNextSegment) return;

    const wasInStoryMode = isInStoryMode; // Capture current story mode state for toast logic

    if (isInStoryMode) {
      setIsLoadingNextSegment(true);
    } else {
      setIsGenerating(true);
      setStorySegments([]); 
    }
    
    resetCurrentGenerationState();
    setStatusMessage('✨ Đang tinh chỉnh ý tưởng kỳ diệu của bạn...');
    toast({ title: "Hãy để phép thuật bắt đầu!", description: "Đang tinh chỉnh lời nhắc của bạn..." });

    try {
      let imageForRefinement: string | undefined = undefined;
      let newImageProvidedForCurrentRefinementSegment = false;
      let previousSegmentRefinedPromptForRefinement: string | undefined = undefined;
      let lastFrameOfPrevSegmentForRefinementContext: string | undefined = undefined;


      if (wasInStoryMode && storySegments.length > 0) { 
          const prevSegment = storySegments[storySegments.length - 1];
          previousSegmentRefinedPromptForRefinement = prevSegment.refinedPromptThisSegment;
          lastFrameOfPrevSegmentForRefinementContext = prevSegment.allFramesThisSegment[prevSegment.allFramesThisSegment.length - 1];

          if (nextSegmentUserUploadedImageDataUri) { 
              imageForRefinement = nextSegmentUserUploadedImageDataUri;
              newImageProvidedForCurrentRefinementSegment = true;
          } else { 
              imageForRefinement = lastFrameOfPrevSegmentForRefinementContext;
              newImageProvidedForCurrentRefinementSegment = false; 
          }
      } else { 
          imageForRefinement = initialUploadedImageDataUri;
          if (initialUploadedImageDataUri) {
            newImageProvidedForCurrentRefinementSegment = true; 
          }
      }

      const refineInputArgs: RefinePromptInput = {
        originalPrompt: currentPromptForGeneration,
        uploadedImageDataUri: imageForRefinement,
        newImageProvidedForCurrentSegment: newImageProvidedForCurrentRefinementSegment,
        isContinuation: wasInStoryMode && storySegments.length > 0,
        previousSegmentRefinedPrompt: previousSegmentRefinedPromptForRefinement,
        ...(selectedStyle !== 'default' && { selectedStyle }),
        ...(selectedMood !== 'default' && { selectedMood }),
      };
      
      const refinedResult = await refineUserPrompt(refineInputArgs);
      setCurrentRefinedPromptText(refinedResult.refinedPrompt);
      setStatusMessage('🎨 Đang tạo các khung hình doodle...');
      toast({ title: "Lời Nhắc Đã Được Tinh Chỉnh!", description: "Đang tạo các khung hình ảnh..." });

      let frameGenInitialRefForThisSegment: string | undefined = undefined;
      let frameGenLastFrameOfPrevSegmentForContext: string | undefined = undefined;
      let frameGenNewImageProvidedForThisSegment = false;

      if (wasInStoryMode && storySegments.length > 0) {
        const prevSegment = storySegments[storySegments.length - 1];
        frameGenLastFrameOfPrevSegmentForContext = prevSegment.allFramesThisSegment[prevSegment.allFramesThisSegment.length - 1];

        if (nextSegmentUserUploadedImageDataUri) { 
          frameGenInitialRefForThisSegment = nextSegmentUserUploadedImageDataUri;
          frameGenNewImageProvidedForThisSegment = true;
        } else { 
          frameGenInitialRefForThisSegment = frameGenLastFrameOfPrevSegmentForContext;
          frameGenNewImageProvidedForThisSegment = false;
        }
      } else { 
        frameGenInitialRefForThisSegment = initialUploadedImageDataUri;
        if (initialUploadedImageDataUri) {
          frameGenNewImageProvidedForThisSegment = true;
        }
      }
      
      const framesInputArgs: GenerateFramesInput = {
        refinedPrompt: refinedResult.refinedPrompt,
        initialFrameReferenceDataUri: frameGenInitialRefForThisSegment, 
        lastFrameOfPreviousSegmentDataUri: frameGenLastFrameOfPrevSegmentForContext, 
        newImageProvidedForCurrentSegment: frameGenNewImageProvidedForThisSegment,
        isFirstSegment: !wasInStoryMode || storySegments.length === 0,
        ...(selectedStyle !== 'default' && { selectedStyle }),
        ...(selectedMood !== 'default' && { selectedMood }),
      };
      
      const framesResult = await generateImageFrames(framesInputArgs);
      
      if (!framesResult.frameUrls || framesResult.frameUrls.length === 0) {
        setStatusMessage('⚠️ Ôi không! AI không thể tạo ra khung hình nào. Hãy thử một ý tưởng khác nhé?');
        toast({ variant: "destructive", title: "Lỗi Tạo Ảnh", description: "Không có khung hình nào được tạo. Vui lòng điều chỉnh lời nhắc của bạn." });
        if (wasInStoryMode) setIsLoadingNextSegment(false); else setIsGenerating(false);
        return;
      }
      
      setCurrentGeneratedFrames(framesResult.frameUrls);

      if (framesResult.frameUrls.length < 2) { 
        setStatusMessage('⚠️ Rất tiếc! Không đủ khung hình để tạo điều kỳ diệu. Hãy thử một ý tưởng khác nhé?');
        toast({ variant: "destructive", title: "Lỗi Tạo Ảnh", description: "Không thể tạo đủ khung hình cho GIF." });
        if (wasInStoryMode) setIsLoadingNextSegment(false); else setIsGenerating(false);
        return;
      }
      
      setStatusMessage('🎞️ Đang dệt các khung hình thành một hoạt ảnh GIF tuyệt vời...');
      toast({ title: "Các Khung Hình Đã Được Tạo!", description: `Đã tạo ${framesResult.frameUrls.length} khung hình. Đang tạo GIF...` });

      const gifUrl = await createGifFromPngs(framesResult.frameUrls, 4);
      setCurrentGeneratedGifUrl(gifUrl);
      setStatusMessage('🎉 Xong! Phần GIF kỳ diệu của bạn đã sẵn sàng!');
      

      const newSegment: StorySegment = {
        id: Date.now().toString(),
        gifUrl,
        refinedPromptThisSegment: refinedResult.refinedPrompt,
        allFramesThisSegment: framesResult.frameUrls,
        originalUserPromptThisSegment: currentPromptForGeneration,
        uploadedImageForThisSegmentDisplayUrl: wasInStoryMode ? nextSegmentUserUploadedImageDisplayUrl : initialUploadedImageDisplayUrl,
      };
      
      setStorySegments(prev => {
          const updatedSegments = [...prev, newSegment];
          const isNowEffectivelyStoryMode = wasInStoryMode || (!wasInStoryMode && updatedSegments.length > 0);

          if (isNowEffectivelyStoryMode && updatedSegments.length > 0) {
            setCurrentGeneratedGifUrl(updatedSegments[updatedSegments.length-1].gifUrl);
            setCurrentGeneratedFrames(updatedSegments[updatedSegments.length-1].allFramesThisSegment);
            setCurrentRefinedPromptText(updatedSegments[updatedSegments.length-1].refinedPromptThisSegment);
          }
          return updatedSegments;
      });
      
      if (wasInStoryMode) {
        setSuccessToastType('segmentAdded');
      } else {
        setSuccessToastType('initialGifReady');
      }
      setShowSuccessToast(true);


      if (!wasInStoryMode && framesResult.frameUrls.length > 0) { 
        setIsInStoryMode(true); 
      }
      setNextStoryPromptInput(''); 
      setNextSegmentUserUploadedImageDataUri(undefined);
      setNextSegmentUserUploadedImageDisplayUrl(null);
      if (nextSegmentFileInputRef.current) nextSegmentFileInputRef.current.value = '';
      
      setActiveTab('output');


    } catch (error: any) {
      console.error('Generation failed:', error);
      const errorMessage = getErrorMessage(error, 'Một sự cố kỳ diệu không xác định đã xảy ra. Vui lòng thử lại.');
      setStatusMessage(`❌ Ôi không! ${errorMessage}`);
      toast({ variant: "destructive", title: "Phép Thuật Thất Bại", description: errorMessage });
    } finally {
      if (wasInStoryMode) setIsLoadingNextSegment(false); else setIsGenerating(false);
    }
  };

  const handleDownloadGif = (gifUrlToDownload: string | null, segmentIndex?: number) => {
    if (!gifUrlToDownload) return;
    const link = document.createElement('a');
    link.href = gifUrlToDownload;
    const fileName = segmentIndex !== undefined ? `hoat-anh-ky-dieu-phan-${segmentIndex + 1}.gif` : 'hoat-anh-ky-dieu.gif';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Bắt Đầu Tải Xuống", description: `${fileName} của bạn đang được tải xuống.`});
  };

  const handleDownloadSingleFrame = (dataUrl: string, frameIndex: number, segmentId?: string) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    
    let fileExtension = 'png'; 
    const mimeTypeMatch = dataUrl.match(/^data:image\/([a-zA-Z+.-]+);/);
    if (mimeTypeMatch && mimeTypeMatch[1]) {
        fileExtension = mimeTypeMatch[1];
    }
    const segmentSuffix = segmentId ? `_phan-${storySegments.findIndex(s => s.id === segmentId) + 1}` : '';
    link.download = `khung-hinh${segmentSuffix}_${frameIndex + 1}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Bắt Đầu Tải Khung Hình", description: `${link.download} của bạn đang được tải xuống.`});
  };
  
  const handleResetStory = () => {
    setIsInStoryMode(false);
    setStorySegments([]);
    setPromptValue('một chú chó shiba đang chạy trên đồng cỏ'); 
    setNextStoryPromptInput('');
    setInitialUploadedImageDataUri(undefined);
    setInitialUploadedImageDisplayUrl(null);
    if (initialFileInputRef.current) initialFileInputRef.current.value = '';
    setNextSegmentUserUploadedImageDataUri(undefined);
    setNextSegmentUserUploadedImageDisplayUrl(null);
    if (nextSegmentFileInputRef.current) nextSegmentFileInputRef.current.value = '';
    setSelectedStyle('default');
    setSelectedMood('default');
    resetCurrentGenerationState();
    setStatusMessage('Sẵn sàng cho câu chuyện mới!');
    toast({ title: "Câu Chuyện Mới", description: "Đã đặt lại, sẵn sàng cho ý tưởng tiếp theo của bạn!" });
  };

  const handleApplyTextOverlay = async () => {
    if (!currentGeneratedFrames.length || !textOverlayInput.trim()) {
      toast({
        variant: 'destructive',
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập nội dung chữ để thêm vào GIF.',
      });
      return;
    }
    setIsApplyingTextOverlay(true);
    setStatusMessage('✍️ Đang thêm chữ vào GIF của bạn...');
    toast({ title: 'Đang Xử Lý', description: 'Đang thêm lớp phủ văn bản vào GIF...' });

    try {
      const textOverlayOptions: TextOverlayOptions = {
        text: textOverlayInput,
        fontFamily: textOverlayFontFamily,
        color: textOverlayColor,
        position: textOverlayPosition,
      };
      const newGifUrl = await createGifFromPngs(currentGeneratedFrames, 4, textOverlayOptions);
      setCurrentGeneratedGifUrl(newGifUrl);

      if (storySegments.length > 0) {
        const latestSegmentId = storySegments[storySegments.length - 1].id;
        setStorySegments(prevSegments =>
          prevSegments.map(segment =>
            segment.id === latestSegmentId ? { ...segment, gifUrl: newGifUrl } : segment
          )
        );
      }
      setStatusMessage('🎉 GIF với chữ đã được cập nhật!');
      toast({ title: 'Thành Công!', description: 'Đã thêm chữ vào GIF của bạn.' });

    } catch (error) {
      console.error('Failed to apply text overlay:', error);
      const errorMessage = getErrorMessage(error, 'Không thể thêm chữ vào GIF.');
      setStatusMessage(`❌ ${errorMessage}`);
      toast({ variant: 'destructive', title: 'Lỗi Thêm Chữ', description: errorMessage });
    } finally {
      setIsApplyingTextOverlay(false);
    }
  };


  const isProcessing = isGenerating || isLoadingNextSegment;
  const canStartGeneration = (!isInStoryMode && promptValue.trim() !== "") || (isInStoryMode && storySegments.length === 0 && promptValue.trim() !== "") || (isInStoryMode && storySegments.length > 0 && nextStoryPromptInput.trim() !== "");

  function getErrorMessage(error: unknown, defaultMessage: string): string {
    let rawMessage = '';
    if (typeof error === 'string') {
      rawMessage = error;
    } else if (error instanceof Error && typeof error.message === 'string') {
      rawMessage = error.message;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      const messageValue = (error as { message: unknown }).message;
      if (typeof messageValue === 'string') {
        rawMessage = messageValue;
      }
    }
  
    if (rawMessage.includes('503 Service Unavailable') || rawMessage.toLowerCase().includes('model is overloaded')) {
      return 'Máy chủ AI hiện đang quá tải. Vui lòng thử lại sau ít phút.';
    }
    
    return rawMessage || defaultMessage;
  }


  return (
    <div className="flex flex-col items-center min-h-screen p-4 md:p-8 font-body bg-gradient-to-br from-background to-secondary/30">
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-4xl md:text-6xl font-extrabold font-headline tracking-tight">
          <span className="bg-gradient-to-r from-primary via-accent to-yellow-400 text-transparent bg-clip-text animate-pulse-once">
            Trình Tạo
          </span>{' '}
          GIF Kỳ Diệu
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mt-2">
          Biến ý tưởng của bạn thành ảnh động doodle vui nhộn hoặc kể một câu chuyện tương tác!
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <Card className="shadow-xl border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Wand2 className="h-7 w-7 text-primary" />
              {isInStoryMode && storySegments.length > 0 ? "Tiếp Tục Câu Chuyện Của Bạn" : "Tạo Ảnh GIF Mới / Bắt Đầu Câu Chuyện"}
            </CardTitle>
            <CardDescription>
              {isInStoryMode && storySegments.length > 0 
                ? "Mô tả điều gì xảy ra tiếp theo. Bạn có thể tải ảnh mới để AI tham chiếu cho chủ thể mới hoặc thay đổi trong phần này."
                : "Mô tả ý tưởng, chọn phong cách, tâm trạng và tùy chọn tải lên hình ảnh tham chiếu ban đầu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {(!isInStoryMode || storySegments.length === 0) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="prompt-input" className="text-base font-semibold">
                    Mô Tả Ảnh Động <span className="text-destructive">* (Bắt buộc)</span>
                  </Label>
                  <Textarea
                    id="prompt-input"
                    ref={promptInputRef}
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    onFocus={handlePromptFocus}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && promptValue.trim()) handleStartOrContinueStory(); }}
                    placeholder="Ví dụ: một chú mèo nhảy múa dưới mưa, một con gấu trúc ăn tre..."
                    className="pl-4 pr-4 py-3 text-base border-2 border-input focus:border-primary focus:ring-primary transition-all duration-300 ease-in-out rounded-lg shadow-sm"
                    rows={3}
                    disabled={isProcessing}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="style-select" className="text-base font-semibold flex items-center gap-2">
                      <Palette className="h-5 w-5 text-muted-foreground" />
                      Phong Cách
                    </Label>
                    <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isProcessing}>
                      <SelectTrigger id="style-select" className="w-full">
                        <SelectValue placeholder="Chọn phong cách" />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mood-select" className="text-base font-semibold flex items-center gap-2">
                      <Smile className="h-5 w-5 text-muted-foreground" />
                      Tâm Trạng
                    </Label>
                    <Select value={selectedMood} onValueChange={setSelectedMood} disabled={isProcessing}>
                      <SelectTrigger id="mood-select" className="w-full">
                        <SelectValue placeholder="Chọn tâm trạng" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOOD_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initial-image-upload" className="text-base font-semibold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    Tải Ảnh Lên (Tùy chọn tham chiếu ban đầu)
                  </Label>
                  <Input
                    id="initial-image-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    ref={initialFileInputRef}
                    onChange={handleInitialImageUpload}
                    className="text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    disabled={isProcessing}
                  />
                  {initialUploadedImageDisplayUrl && (
                    <div className="mt-4 p-2 border border-primary/20 rounded-lg bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-2">Ảnh đã tải lên (cho phần đầu):</p>
                      <Image src={initialUploadedImageDisplayUrl} alt="Ảnh đã tải lên ban đầu" width={150} height={150} className="rounded-md object-contain max-h-40 w-auto shadow-sm" data-ai-hint="user uploaded image" />
                      <Button variant="link" size="sm" className="text-destructive px-0 h-auto py-1 mt-1" onClick={() => {
                        setInitialUploadedImageDisplayUrl(null);
                        setInitialUploadedImageDataUri(undefined);
                        if (initialFileInputRef.current) initialFileInputRef.current.value = '';
                      }} disabled={isProcessing}>
                        Xóa ảnh
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {(isInStoryMode && storySegments.length > 0) && (
                <div className="space-y-4 pt-4 border-t border-primary/20">
                    <div>
                        <Label htmlFor="next-prompt-input" className="text-base font-semibold flex items-center gap-2">
                            <CornerDownRight className="h-5 w-5 text-primary" />
                            Điều Gì Xảy Ra Tiếp Theo? <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="next-prompt-input"
                            ref={nextPromptInputRef}
                            value={nextStoryPromptInput}
                            onChange={(e) => setNextStoryPromptInput(e.target.value)}
                            onFocus={handleNextPromptFocus}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && nextStoryPromptInput.trim()) handleStartOrContinueStory(); }}
                            placeholder="Ví dụ: con chó shiba gặp một con mèo..."
                            className="pl-4 pr-4 py-3 text-base border-2 border-input focus:border-primary focus:ring-primary rounded-lg shadow-sm"
                            rows={2}
                            disabled={isProcessing}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="next-segment-image-upload" className="text-base font-semibold flex items-center gap-2">
                            <FileImage className="h-5 w-5 text-muted-foreground" />
                            Tải Ảnh Mới Cho Phần Này (Tùy chọn, ví dụ cho chủ thể mới)
                        </Label>
                        <Input
                            id="next-segment-image-upload"
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            ref={nextSegmentFileInputRef}
                            onChange={handleNextSegmentImageUpload}
                            className="text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            disabled={isProcessing}
                        />
                        {nextSegmentUserUploadedImageDisplayUrl && (
                            <div className="mt-4 p-2 border border-primary/20 rounded-lg bg-muted/30">
                            <p className="text-sm text-muted-foreground mb-2">Ảnh tham chiếu cho phần này:</p>
                            <Image src={nextSegmentUserUploadedImageDisplayUrl} alt="Ảnh tải lên cho phần tiếp theo" width={150} height={150} className="rounded-md object-contain max-h-40 w-auto shadow-sm" data-ai-hint="user uploaded image segment" />
                            <Button variant="link" size="sm" className="text-destructive px-0 h-auto py-1 mt-1" onClick={() => {
                                setNextSegmentUserUploadedImageDisplayUrl(null);
                                setNextSegmentUserUploadedImageDataUri(undefined);
                                if (nextSegmentFileInputRef.current) nextSegmentFileInputRef.current.value = '';
                            }} disabled={isProcessing}>
                                Xóa ảnh này
                            </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <Button
              id="generate-button"
              onClick={() => handleStartOrContinueStory()}
              disabled={isProcessing || !canStartGeneration}
              className="w-full text-lg font-semibold py-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 rounded-lg shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang Tạo Điều Kỳ Diệu...
                </>
              ) : (isInStoryMode && storySegments.length > 0) ? (
                <>
                  <BookOpen className="mr-2 h-5 w-5" />
                  Tiếp Tục Câu Chuyện
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Bắt Đầu Câu Chuyện / Tạo GIF
                </>
              )}
            </Button>
            {(isInStoryMode && storySegments.length > 0) && (
                <Button variant="outline" onClick={handleResetStory} className="w-full flex items-center gap-2" disabled={isProcessing}>
                    <RotateCcw className="h-4 w-4"/> Bắt Đầu Câu Chuyện Mới
                </Button>
            )}
          </CardContent>
        </Card>

        {(currentGeneratedFrames.length > 0 || currentGeneratedGifUrl) && (
          <Card className="shadow-xl border-primary/20 bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Kết quả cho phần hiện tại</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'frames' | 'output')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 rounded-lg p-1">
                  <TabsTrigger value="frames" className="py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all">Khung Hình Hiện Tại</TabsTrigger>
                  <TabsTrigger value="output" className="py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all">GIF Hiện Tại</TabsTrigger>
                </TabsList>
                
                {currentRefinedPromptText && (
                  <div className="mb-4 p-3 bg-secondary/30 rounded-md border border-primary/20">
                    <p className="text-sm text-muted-foreground font-medium">
                      <span className="font-bold text-primary">Lời Nhắc Tinh Chỉnh (cho phần hiện tại):</span> {currentRefinedPromptText}
                    </p>
                  </div>
                )}

                <TabsContent value="frames" className="animate-fadeIn">
                  <div id="frames-container" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1 bg-muted/30 rounded-lg border border-primary/10">
                    {currentGeneratedFrames.map((frame, index) => (
                      <div key={`current-${index}`} className="aspect-square border border-primary/20 rounded-md overflow-hidden shadow-sm relative animate-fadeIn group">
                        <Image src={frame} alt={`Khung ${index + 1}`} layout="fill" objectFit="contain" className="bg-white" data-ai-hint="doodle animation" />
                        <span className="absolute top-1 right-1 bg-primary/80 text-primary-foreground text-xs px-1.5 py-0.5 rounded-full shadow-md">{index + 1}</span>
                        <Button
                          onClick={() => handleDownloadSingleFrame(frame, index, storySegments.length > 0 ? storySegments[storySegments.length - 1].id : undefined)}
                          variant="outline"
                          size="icon"
                          className="absolute bottom-1 right-1 h-7 w-7 bg-background/70 hover:bg-primary/70 hover:text-primary-foreground border-primary/40 text-primary shadow backdrop-blur-sm rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                          aria-label={`Tải khung ${index + 1}`}
                        >
                          <DownloadCloud className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {isProcessing && currentGeneratedFrames.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                            <p>Đang tải khung hình...</p>
                        </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="output" className="animate-fadeIn">
                  <div id="result-container" ref={resultContainerRef} className="flex flex-col items-center space-y-4 p-1 bg-muted/30 rounded-lg border border-primary/10">
                    {currentGeneratedGifUrl ? (
                      <div className="relative group shadow-lg rounded-lg overflow-hidden border-2 border-primary/30">
                        <Image src={currentGeneratedGifUrl} alt="GIF Đã Tạo" width={400} height={400} objectFit="contain" className="bg-white" unoptimized data-ai-hint="generated gif animation"/>
                        <Button
                          onClick={() => handleDownloadGif(currentGeneratedGifUrl, storySegments.length > 0 ? storySegments.length -1 : undefined )}
                          variant="outline"
                          size="icon"
                          className="absolute bottom-3 right-3 h-10 w-10 bg-background/80 hover:bg-primary/80 hover:text-primary-foreground border-primary/50 text-primary shadow-md backdrop-blur-sm rounded-full transition-all duration-300 opacity-70 group-hover:opacity-100 scale-90 group-hover:scale-100"
                          aria-label="Tải GIF Hiện Tại"
                        >
                          <Download className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : isProcessing && activeTab === 'output' ? (
                       <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                         <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                         <p>Đang triệu hồi GIF của bạn...</p>
                       </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                        <p>GIF của bạn sẽ xuất hiện ở đây sau khi được tạo.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {currentGeneratedGifUrl && currentGeneratedFrames.length > 0 && (
                <Card className="mt-6 border-accent/50 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Type className="h-5 w-5 text-accent" />
                      Thêm Chữ Vào GIF Hiện Tại (Tùy chọn)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="text-overlay-input">Nội dung chữ</Label>
                      <Input
                        id="text-overlay-input"
                        value={textOverlayInput}
                        onChange={(e) => setTextOverlayInput(e.target.value)}
                        placeholder="Nhập chữ của bạn ở đây..."
                        disabled={isApplyingTextOverlay}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="text-overlay-font">Phông chữ</Label>
                        <Select value={textOverlayFontFamily} onValueChange={setTextOverlayFontFamily} disabled={isApplyingTextOverlay}>
                          <SelectTrigger id="text-overlay-font">
                            <SelectValue placeholder="Chọn phông chữ" />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_FAMILY_OPTIONS.map(font => (
                              <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="text-overlay-color">Màu chữ</Label>
                        <Input
                          id="text-overlay-color"
                          type="color"
                          value={textOverlayColor}
                          onChange={(e) => setTextOverlayColor(e.target.value)}
                          className="h-10"
                          disabled={isApplyingTextOverlay}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="text-overlay-position">Vị trí</Label>
                        <Select value={textOverlayPosition} onValueChange={(v) => setTextOverlayPosition(v as TextOverlayOptions['position'])} disabled={isApplyingTextOverlay}>
                          <SelectTrigger id="text-overlay-position">
                            <SelectValue placeholder="Chọn vị trí" />
                          </SelectTrigger>
                          <SelectContent>
                            {TEXT_POSITION_OPTIONS.map(pos => (
                              <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={handleApplyTextOverlay}
                      disabled={isApplyingTextOverlay || !textOverlayInput.trim()}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      {isApplyingTextOverlay ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Cập Nhật GIF Với Chữ
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}
        
        {isInStoryMode && storySegments.length > 0 && (
            <Card className="shadow-xl border-accent/30 mt-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <BookOpen className="h-6 w-6 text-accent" />
                        Câu Chuyện Của Bạn Đến Hiện Tại
                    </CardTitle>
                    <CardDescription>Các phần GIF đã tạo trong câu chuyện của bạn. Phần mới nhất sẽ hiển thị ở khu vực "Kết quả cho phần hiện tại" ở trên sau khi tạo xong.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                    {storySegments.map((segment, index) => (
                        <div key={segment.id} className="p-4 border border-primary/20 rounded-lg bg-card/90 animate-fadeIn" style={{ animationDelay: `${index * 100}ms`}}>
                            <div className="flex flex-col sm:flex-row gap-4">
                                {segment.uploadedImageForThisSegmentDisplayUrl && (
                                    <div className="flex-shrink-0">
                                        <p className="text-xs text-muted-foreground mb-1">Ảnh tham chiếu đã dùng:</p>
                                        <Image 
                                            src={segment.uploadedImageForThisSegmentDisplayUrl} 
                                            alt={`Ảnh tham chiếu cho phần ${index + 1}`} 
                                            width={80} 
                                            height={80} 
                                            className="rounded-md object-contain border bg-white shadow-sm"
                                            data-ai-hint="reference image story"
                                        />
                                    </div>
                                )}
                                <div className="flex-grow">
                                    <p className="text-sm text-muted-foreground mb-1">
                                        <span className="font-semibold text-primary">Phần {index + 1}:</span> {segment.originalUserPromptThisSegment}
                                    </p>
                                    {segment.refinedPromptThisSegment && (
                                        <p className="text-xs text-muted-foreground mb-2 italic pl-2 border-l-2 border-primary/30">
                                            AI đã diễn giải: "{segment.refinedPromptThisSegment.length > 150 ? segment.refinedPromptThisSegment.substring(0,150) + '...' : segment.refinedPromptThisSegment }"
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="relative group aspect-video max-w-xs mx-auto border rounded-md overflow-hidden shadow-md mt-3">
                                <Image src={segment.gifUrl} alt={`Phần ${index + 1} của câu chuyện`} layout="fill" objectFit="contain" className="bg-white" unoptimized data-ai-hint="story segment gif"/>
                                <Button
                                  onClick={() => handleDownloadGif(segment.gifUrl, index)}
                                  variant="outline"
                                  size="sm"
                                  className="absolute bottom-2 right-2 h-8  bg-background/70 hover:bg-primary/70 hover:text-primary-foreground border-primary/40 text-primary shadow-sm backdrop-blur-sm rounded-md transition-all duration-300 opacity-50 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                  aria-label={`Tải GIF Phần ${index + 1}`}
                                >
                                  <Download className="h-4 w-4 mr-1" /> Tải Phần {index + 1}
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}


        {statusMessage && (!isProcessing && !isApplyingTextOverlay) && (
          <div id="status-display" className="text-center text-sm md:text-base text-foreground p-3 bg-card/70 backdrop-blur-sm rounded-lg shadow-md border border-primary/20 transition-all duration-300">
            {statusMessage}
          </div>
        )}
      </main>

      <footer className="mt-auto pt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} DoodleGIF. Được hỗ trợ bởi Phép Thuật AI.</p>
        <p className="text-xs mt-1">Lưu ý: Việc tạo ảnh GIF có thể mất một chút thời gian. Hãy kiên nhẫn nhé!</p>
      </footer>
    </div>
  );
}

