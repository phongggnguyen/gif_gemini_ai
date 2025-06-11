'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Wand2, Sparkles, Download, Loader2, AlertTriangle } from 'lucide-react';
import { refineUserPrompt, generateImageFrames } from './actions';
import { createGifFromPngs } from '@/lib/gif-utils';
import { useToast } from "@/hooks/use-toast";

export default function MagicalGifMakerPage() {
  const [promptValue, setPromptValue] = useState<string>('a shiba inu eating ice-cream');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [generatedGifUrl, setGeneratedGifUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'frames' | 'output'>('frames');
  const [refinedPromptText, setRefinedPromptText] = useState<string | null>(null);

  const { toast } = useToast();
  const resultContainerRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (generatedGifUrl && activeTab === 'output' && resultContainerRef.current) {
      resultContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generatedGifUrl, activeTab]);

  const handlePromptFocus = () => {
    promptInputRef.current?.select();
  };

  const handleSubmit = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (!promptValue.trim() || isGenerating) return;

    setIsGenerating(true);
    setGeneratedFrames([]);
    setGeneratedGifUrl(null);
    setRefinedPromptText(null);
    setActiveTab('frames');
    setStatusMessage('✨ Refining your magical idea...');
    toast({ title: "Let the magic begin!", description: "Refining your prompt..." });

    try {
      const refinedResult = await refineUserPrompt({ originalPrompt: promptValue });
      setRefinedPromptText(refinedResult.refinedPrompt);
      setStatusMessage('🎨 Conjuring doodle frames...');
      toast({ title: "Prompt Refined!", description: "Now generating image frames..." });

      const framesResult = await generateImageFrames({ refinedPrompt: refinedResult.refinedPrompt });
      setGeneratedFrames(framesResult.frameUrls);

      if (framesResult.frameUrls.length < 2) {
        setStatusMessage('⚠️ Oops! Not enough frames to make magic. Try a different idea?');
        toast({ variant: "destructive", title: "Generation Error", description: "Could not generate enough frames for a GIF." });
        setIsGenerating(false);
        return;
      }
      
      setStatusMessage('🎞️ Weaving frames into a GIFtastic animation...');
      toast({ title: "Frames Generated!", description: `Generated ${framesResult.frameUrls.length} frames. Now creating GIF...` });

      const gifUrl = await createGifFromPngs(framesResult.frameUrls, 4); // 4 FPS
      setGeneratedGifUrl(gifUrl);
      setStatusMessage('🎉 Voila! Your magical GIF is ready!');
      toast({ title: "GIF Ready!", description: "Your magical animation is complete." });
      setActiveTab('output');

    } catch (error: any) {
      console.error('Generation failed:', error);
      const errorMessage = error.message || 'An unknown magical mishap occurred. Please try again.';
      setStatusMessage(`❌ Oh no! ${errorMessage}`);
      toast({ variant: "destructive", title: "Magic Failed", description: errorMessage });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadGif = () => {
    if (!generatedGifUrl) return;
    const link = document.createElement('a');
    link.href = generatedGifUrl;
    link.download = 'magical-animation.gif';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download Started", description: "Your GIF is being downloaded."});
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4 md:p-8 font-body bg-gradient-to-br from-background to-secondary/30">
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-4xl md:text-6xl font-extrabold font-headline tracking-tight">
          <span className="bg-gradient-to-r from-primary via-accent to-yellow-400 text-transparent bg-clip-text animate-pulse-once">
            Magical
          </span>{' '}
          GIF Maker
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mt-2">
          Turn your ideas into fun animated doodles!
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <Card className="shadow-xl border-primary/30">
          <CardContent className="p-6 space-y-6">
            <div className="relative">
              <Wand2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
              <Textarea
                id="prompt-input"
                ref={promptInputRef}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onFocus={handlePromptFocus}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(); }}
                placeholder="Describe your animation... e.g., a cat dancing in the rain"
                className="pl-10 pr-4 py-3 text-base border-2 border-input focus:border-primary focus:ring-primary transition-all duration-300 ease-in-out rounded-lg shadow-sm"
                rows={3}
                disabled={isGenerating}
              />
            </div>
            <Button
              id="generate-button"
              onClick={() => handleSubmit()}
              disabled={isGenerating || !promptValue.trim()}
              className="w-full text-lg font-semibold py-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 rounded-lg shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Magic...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Magic
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {(generatedFrames.length > 0 || generatedGifUrl) && (
          <Card className="shadow-xl border-primary/20 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'frames' | 'output')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 rounded-lg p-1">
                  <TabsTrigger value="frames" className="py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all">Frames</TabsTrigger>
                  <TabsTrigger value="output" className="py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all">Output GIF</TabsTrigger>
                </TabsList>
                
                {refinedPromptText && (
                  <div className="mb-4 p-3 bg-secondary/30 rounded-md border border-primary/20">
                    <p className="text-sm text-muted-foreground font-medium">
                      <span className="font-bold text-primary">Magically Refined Prompt:</span> {refinedPromptText}
                    </p>
                  </div>
                )}

                <TabsContent value="frames" className="animate-fadeIn">
                  <div id="frames-container" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1 bg-muted/30 rounded-lg border border-primary/10">
                    {generatedFrames.map((frame, index) => (
                      <div key={index} className="aspect-square border border-primary/20 rounded-md overflow-hidden shadow-sm relative animate-fadeIn" style={{ animationDelay: `${index * 50}ms`}}>
                        <Image src={frame} alt={`Frame ${index + 1}`} layout="fill" objectFit="contain" className="bg-white" data-ai-hint="doodle animation" />
                        <span className="absolute top-1 right-1 bg-primary/80 text-primary-foreground text-xs px-1.5 py-0.5 rounded-full shadow-md">{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="output" className="animate-fadeIn">
                  <div id="result-container" ref={resultContainerRef} className="flex flex-col items-center space-y-4 p-1 bg-muted/30 rounded-lg border border-primary/10">
                    {generatedGifUrl ? (
                      <div className="relative group shadow-lg rounded-lg overflow-hidden border-2 border-primary/30">
                        <Image src={generatedGifUrl} alt="Generated GIF" width={400} height={400} objectFit="contain" className="bg-white" unoptimized />
                        <Button
                          onClick={handleDownloadGif}
                          variant="outline"
                          size="icon"
                          className="absolute bottom-3 right-3 h-10 w-10 bg-background/80 hover:bg-primary/80 hover:text-primary-foreground border-primary/50 text-primary shadow-md backdrop-blur-sm rounded-full transition-all duration-300 opacity-70 group-hover:opacity-100 scale-90 group-hover:scale-100"
                          aria-label="Download GIF"
                        >
                          <Download className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : isGenerating && activeTab === 'output' ? (
                       <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                         <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                         <p>Summoning your GIF...</p>
                       </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                        <p>Your GIF will appear here once generated.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
        <p>&copy; {new Date().getFullYear()} DoodleGIF. Powered by AI Magic.</p>
      </footer>
    </div>
  );
}
