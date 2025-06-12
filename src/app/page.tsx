
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
import { Wand2, Sparkles, Download, Loader2, AlertTriangle, Upload, ImageIcon, Palette, Smile, BookOpen, CornerDownRight, FileImage } from 'lucide-react';
import { refineUserPrompt, generateImageFrames, type RefinePromptInput, type GenerateFramesInput } from './actions';
import { createGifFromPngs } from '@/lib/gif-utils';
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

interface StorySegment {
  gifUrl: string;
  refinedPromptThisSegment: string;
  allFramesThisSegment: string[];
  originalUserPromptThisSegment: string;
}

export default function MagicalGifMakerPage() {
  const [promptValue, setPromptValue] = useState<string>('một chú chó shiba đang ăn kem');
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


  const resetCurrentGeneration = () => {
    setCurrentGeneratedFrames([]);
    setCurrentGeneratedGifUrl(null);
    setCurrentRefinedPromptText(null);
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

    if (isInStoryMode) {
      setIsLoadingNextSegment(true);
    } else {
      setIsGenerating(true);
      setStorySegments([]); 
    }
    
    resetCurrentGeneration();
    setStatusMessage('✨ Đang tinh chỉnh ý tưởng kỳ diệu của bạn...');
    toast({ title: "Hãy để phép thuật bắt đầu!", description: "Đang tinh chỉnh lời nhắc của bạn..." });

    try {
      let referenceImageForRefinement: string | undefined = undefined;
      if (isInStoryMode) {
          if (nextSegmentUserUploadedImageDataUri) {
              referenceImageForRefinement = nextSegmentUserUploadedImageDataUri;
          } else if (storySegments.length > 0) {
              const prevSegment = storySegments[storySegments.length - 1];
              referenceImageForRefinement = prevSegment.allFramesThisSegment[prevSegment.allFramesThisSegment.length - 1];
          }
      } else {
          referenceImageForRefinement = initialUploadedImageDataUri;
      }

      const refineInputArgs: RefinePromptInput = {
        originalPrompt: currentPromptForGeneration,
        uploadedImageDataUri: referenceImageForRefinement,
        isContinuation: isInStoryMode,
        ...(isInStoryMode && storySegments.length > 0 && { 
            previousSegmentRefinedPrompt: storySegments[storySegments.length - 1].refinedPromptThisSegment,
        }),
        ...(selectedStyle !== 'default' && { selectedStyle }),
        ...(selectedMood !== 'default' && { selectedMood }),
      };
      
      const refinedResult = await refineUserPrompt(refineInputArgs);

      setCurrentRefinedPromptText(refinedResult.refinedPrompt);
      setStatusMessage('🎨 Đang tạo các khung hình doodle...');
      toast({ title: "Lời Nhắc Đã Được Tinh Chỉnh!", description: "Đang tạo các khung hình ảnh..." });

      let referenceImageForFrameGeneration: string | undefined = undefined;
      if (isInStoryMode) {
          if (nextSegmentUserUploadedImageDataUri) {
              referenceImageForFrameGeneration = nextSegmentUserUploadedImageDataUri;
          } else if (storySegments.length > 0) {
              const prevSegment = storySegments[storySegments.length - 1];
              referenceImageForFrameGeneration = prevSegment.allFramesThisSegment[prevSegment.allFramesThisSegment.length - 1];
          }
      } else {
          referenceImageForFrameGeneration = initialUploadedImageDataUri;
      }

      const framesInputArgs: GenerateFramesInput = {
        refinedPrompt: refinedResult.refinedPrompt,
        initialFrameReferenceDataUri: referenceImageForFrameGeneration,
        isFirstSegment: !isInStoryMode,
        ...(selectedStyle !== 'default' && { selectedStyle }),
        ...(selectedMood !== 'default' && { selectedMood }),
      };
      
      const framesResult = await generateImageFrames(framesInputArgs);
      
      if (!framesResult.frameUrls || framesResult.frameUrls.length === 0) {
        setStatusMessage('⚠️ Ôi không! AI không thể tạo ra khung hình nào. Hãy thử một ý tưởng khác nhé?');
        toast({ variant: "destructive", title: "Lỗi Tạo Ảnh", description: "Không có khung hình nào được tạo. Vui lòng điều chỉnh lời nhắc của bạn." });
        if (isInStoryMode) setIsLoadingNextSegment(false); else setIsGenerating(false);
        return;
      }
      
      setCurrentGeneratedFrames(framesResult.frameUrls);

      if (framesResult.frameUrls.length < 2) {
        setStatusMessage('⚠️ Rất tiếc! Không đủ khung hình để tạo điều kỳ diệu. Hãy thử một ý tưởng khác nhé?');
        toast({ variant: "destructive", title: "Lỗi Tạo Ảnh", description: "Không thể tạo đủ khung hình cho GIF." });
        if (isInStoryMode) setIsLoadingNextSegment(false); else setIsGenerating(false);
        return;
      }
      
      setStatusMessage('🎞️ Đang dệt các khung hình thành một hoạt ảnh GIF tuyệt vời...');
      toast({ title: "Các Khung Hình Đã Được Tạo!", description: `Đã tạo ${framesResult.frameUrls.length} khung hình. Đang tạo GIF...` });

      const gifUrl = await createGifFromPngs(framesResult.frameUrls, 4); // 4 FPS
      setCurrentGeneratedGifUrl(gifUrl);
      setStatusMessage('🎉 Xong! Phần GIF kỳ diệu của bạn đã sẵn sàng!');
      toast({ title: "GIF Đã Sẵn Sàng!", description: "Hoạt ảnh kỳ diệu của bạn đã hoàn tất." });
      setActiveTab('output');

      const newSegment: StorySegment = {
        gifUrl,
        refinedPromptThisSegment: refinedResult.refinedPrompt,
        allFramesThisSegment: framesResult.frameUrls,
        originalUserPromptThisSegment: currentPromptForGeneration
      };
      setStorySegments(prev => [...prev, newSegment]);
      
      if (!isInStoryMode) {
        setIsInStoryMode(true); 
      }
      setNextStoryPromptInput(''); 
      setNextSegmentUserUploadedImageDataUri(undefined);
      setNextSegmentUserUploadedImageDisplayUrl(null);
      if (nextSegmentFileInputRef.current) nextSegmentFileInputRef.current.value = '';


    } catch (error: any) {
      console.error('Generation failed:', error);
      const errorMessage = error.message || 'Một sự cố kỳ diệu không xác định đã xảy ra. Vui lòng thử lại.';
      setStatusMessage(`❌ Ôi không! ${errorMessage}`);
      toast({ variant: "destructive", title: "Phép Thuật Thất Bại", description: errorMessage });
    } finally {
      if (isInStoryMode) setIsLoadingNextSegment(false); else setIsGenerating(false);
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
  
  const handleResetStory = () => {
    setIsInStoryMode(false);
    setStorySegments([]);
    setPromptValue('một chú chó shiba đang ăn kem'); 
    setNextStoryPromptInput('');
    setInitialUploadedImageDataUri(undefined);
    setInitialUploadedImageDisplayUrl(null);
    if (initialFileInputRef.current) initialFileInputRef.current.value = '';
    setNextSegmentUserUploadedImageDataUri(undefined);
    setNextSegmentUserUploadedImageDisplayUrl(null);
    if (nextSegmentFileInputRef.current) nextSegmentFileInputRef.current.value = '';
    setSelectedStyle('default');
    setSelectedMood('default');
    resetCurrentGeneration();
    setStatusMessage('Sẵn sàng cho câu chuyện mới!');
    toast({ title: "Câu Chuyện Mới", description: "Đã đặt lại, sẵn sàng cho ý tưởng tiếp theo của bạn!" });
  };


  const isProcessing = isGenerating || isLoadingNextSegment;

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
              {isInStoryMode ? "Tiếp Tục Câu Chuyện Của Bạn" : "Tạo Ảnh GIF Mới"}
            </CardTitle>
            <CardDescription>
              {isInStoryMode 
                ? "Mô tả điều gì xảy ra tiếp theo. Bạn có thể tải ảnh mới để AI tham chiếu cho phần này."
                : "Mô tả ý tưởng, chọn phong cách, tâm trạng và tùy chọn tải lên hình ảnh tham chiếu ban đầu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {!isInStoryMode && (
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

            {isInStoryMode && (
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
                            placeholder="Ví dụ: con mèo tìm thấy một chiếc mũ ma thuật..."
                            className="pl-4 pr-4 py-3 text-base border-2 border-input focus:border-primary focus:ring-primary rounded-lg shadow-sm"
                            rows={2}
                            disabled={isProcessing}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="next-segment-image-upload" className="text-base font-semibold flex items-center gap-2">
                            <FileImage className="h-5 w-5 text-muted-foreground" />
                            Tải Ảnh Mới Cho Phần Này (Tùy chọn)
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
              disabled={isProcessing || (!isInStoryMode && !promptValue.trim()) || (isInStoryMode && !nextStoryPromptInput.trim())}
              className="w-full text-lg font-semibold py-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 rounded-lg shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang Tạo Điều Kỳ Diệu...
                </>
              ) : isInStoryMode ? (
                <>
                  <BookOpen className="mr-2 h-5 w-5" />
                  Tiếp Tục Câu Chuyện
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Bắt Đầu Câu Chuyện/Tạo GIF
                </>
              )}
            </Button>
            {isInStoryMode && (
                <Button variant="outline" onClick={handleResetStory} className="w-full" disabled={isProcessing}>
                    Bắt Đầu Câu Chuyện Mới
                </Button>
            )}
          </CardContent>
        </Card>

        {(currentGeneratedFrames.length > 0 || currentGeneratedGifUrl) && (
          <Card className="shadow-xl border-primary/20 bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Kết quả hiện tại</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
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
                      <div key={`current-${index}`} className="aspect-square border border-primary/20 rounded-md overflow-hidden shadow-sm relative animate-fadeIn" style={{ animationDelay: `${index * 50}ms`}}>
                        <Image src={frame} alt={`Khung ${index + 1}`} layout="fill" objectFit="contain" className="bg-white" data-ai-hint="doodle animation" />
                        <span className="absolute top-1 right-1 bg-primary/80 text-primary-foreground text-xs px-1.5 py-0.5 rounded-full shadow-md">{index + 1}</span>
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
                          onClick={() => handleDownloadGif(currentGeneratedGifUrl)}
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
                    <CardDescription>Các phần GIF đã tạo trong câu chuyện của bạn.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    {storySegments.map((segment, index) => (
                        <div key={index} className="p-4 border border-primary/20 rounded-lg bg-card/90 animate-fadeIn" style={{ animationDelay: `${index * 100}ms`}}>
                            <p className="text-sm text-muted-foreground mb-1">
                                <span className="font-semibold text-primary">Phần {index + 1}:</span> {segment.originalUserPromptThisSegment}
                            </p>
                            {segment.refinedPromptThisSegment && (
                                 <p className="text-xs text-muted-foreground mb-2 italic pl-4">
                                    AI đã diễn giải: "{segment.refinedPromptThisSegment.length > 100 ? segment.refinedPromptThisSegment.substring(0,100) + '...' : segment.refinedPromptThisSegment }"
                                </p>
                            )}
                            <div className="relative group aspect-video max-w-xs mx-auto border rounded-md overflow-hidden shadow-md">
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


        {statusMessage && (
          <div id="status-display" className="text-center text-sm md:text-base text-foreground p-3 bg-card/70 backdrop-blur-sm rounded-lg shadow-md border border-primary/20 transition-all duration-300">
            {statusMessage}
          </div>
        )}
      </main>

      <footer className="mt-auto pt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} DoodleGIF. Được hỗ trợ bởi Phép Thuật AI.</p>
      </footer>
    </div>
  );
}
    
    
