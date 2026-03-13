'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RuleConfig } from '@/lib/rule-config'
import {
  loadProfiles,
  saveProfile,
  deleteProfile,
  applyProfile,
  type ProjectProfile,
} from '@/lib/project-profiles'

interface ProjectProfileSelectorProps {
  currentPreset: string
  currentRuleConfig: RuleConfig
  onApply: (ruleConfig: RuleConfig, preset: string) => void
}

export function ProjectProfileSelector({
  currentPreset,
  currentRuleConfig,
  onApply,
}: ProjectProfileSelectorProps) {
  const [profiles, setProfiles] = useState<ProjectProfile[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [activeId, setActiveId] = useState<string>('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const refreshProfiles = useCallback(() => {
    setProfiles(loadProfiles())
  }, [])

  useEffect(() => {
    refreshProfiles()
  }, [refreshProfiles])

  const handleApply = () => {
    const profile = profiles.find((p) => p.id === selectedId)
    if (!profile) return
    const { ruleConfig, preset } = applyProfile(profile)
    onApply(ruleConfig, preset)
    setActiveId(profile.id)
  }

  const handleSave = () => {
    if (!newName.trim()) return
    const profile: ProjectProfile = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDescription.trim(),
      ruleConfig: { ...currentRuleConfig },
      preset: currentPreset,
      customRuleIds: [],
      createdAt: new Date().toISOString(),
    }
    saveProfile(profile)
    refreshProfiles()
    setNewName('')
    setNewDescription('')
    setShowSaveForm(false)
    setSelectedId(profile.id)
  }

  const handleDelete = (id: string) => {
    deleteProfile(id)
    if (selectedId === id) setSelectedId('')
    if (activeId === id) setActiveId('')
    refreshProfiles()
  }

  const enabledCategories = (config: RuleConfig) =>
    Object.entries(config)
      .filter(([, v]) => v)
      .map(([k]) => k)

  return (
    <Card className="border-[#1F2D45] bg-[#0B1221]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Project Profiles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile selector */}
        <div className="flex gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="flex-1 border-[#1F2D45] bg-[#0B1221]">
              <SelectValue placeholder="Select a profile..." />
            </SelectTrigger>
            <SelectContent className="border-[#1F2D45] bg-[#0B1221]">
              {profiles.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No profiles saved
                </SelectItem>
              ) : (
                profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.id === activeId ? ' (active)' : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            onClick={handleApply}
            disabled={!selectedId || selectedId === '__none'}
            size="sm"
            className="bg-[#3805E3] hover:bg-[#3805E3]/80 text-white"
          >
            Apply
          </Button>
        </div>

        {/* Profile details and delete */}
        {profiles.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {profiles.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2 rounded text-sm border ${
                  p.id === activeId
                    ? 'border-[#3805E3] bg-[#3805E3]/10'
                    : 'border-[#1F2D45] bg-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    {p.id === activeId && (
                      <Badge
                        variant="outline"
                        className="border-[#3805E3] text-[#A78BFA] text-[10px] px-1.5"
                      >
                        active
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] px-1">
                      {p.preset}
                    </Badge>
                    {enabledCategories(p.ruleConfig).map((cat) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="text-[10px] px-1 border-[#1F2D45]"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0 flex-shrink-0"
                  onClick={() => handleDelete(p.id)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Save current config */}
        {showSaveForm ? (
          <div className="space-y-2 border border-[#1F2D45] rounded p-3">
            <Input
              placeholder="Profile name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border-[#1F2D45] bg-[#0B1221] text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
            />
            <Input
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="border-[#1F2D45] bg-[#0B1221] text-sm"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!newName.trim()}
                size="sm"
                className="bg-[#2DD4BF] hover:bg-[#2DD4BF]/80 text-black"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSaveForm(false)
                  setNewName('')
                  setNewDescription('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-[#1F2D45] hover:border-[#3805E3] hover:text-[#A78BFA]"
            onClick={() => setShowSaveForm(true)}
          >
            Save Current Settings as Profile
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
