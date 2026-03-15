import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export default function SkillList({ skills, onSelect, shouldFilter = true, selectedIndex, children }) {
  return (
    <Command
      shouldFilter={shouldFilter}
      {...(selectedIndex != null && {
        value: skills[selectedIndex]?.name ?? '',
        onValueChange: () => {},
      })}
    >
      {children}
      <CommandList>
        <CommandEmpty>No skills found.</CommandEmpty>
        <CommandGroup>
          {skills.map((skill, index) => (
            <CommandItem
              key={skill.name}
              value={skill.name}
              onSelect={() => onSelect(skill, index)}
            >
              <div className="flex-1 min-w-0">
                <div>{skill.name}</div>
                <div className="text-xs text-muted-foreground">{skill.description}</div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
